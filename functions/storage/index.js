import { telegramProvider } from './telegram.js';
import { r2Provider } from './r2.js';

// Storage provider contract:
//   key                                       - tag persisted in KV metadata for provenance
//   validateConfig(env)                       - throws when required bindings/vars are missing
//   upload(env, file, { fileName, fileExtension }) -> long file id (string)
//   fetchFile(env, request, url, fileId)      -> Response with the file body
//   deleteFile(env, fileId)                   - optional; absent when the backend
//     cannot remove a stored file (Telegram: no message id is kept, so the
//     dashboard can only drop the record)
//   canDelete(env)                            - required alongside deleteFile;
//     false when this deployment could never delete (e.g. the bucket binding was
//     removed), so the caller drops the record instead of blocking forever
const PROVIDERS = {
    [telegramProvider.key]: telegramProvider,
    [r2Provider.key]: r2Provider,
};

export function getUploadProvider(env) {
    const name = (env.STORAGE_PROVIDER || telegramProvider.key).toLowerCase();
    const provider = PROVIDERS[name];

    if (!provider) {
        throw new Error(`Unknown STORAGE_PROVIDER: ${env.STORAGE_PROVIDER}`);
    }

    return provider;
}

// Ids are self-describing (R2 ids carry the 'r2-' prefix), so serving does not
// depend on a KV metadata read; ids that predate providers are Telegram/Telegraph.
export function getServingProvider(fileId) {
    if (r2Provider.ownsId(fileId)) {
        return r2Provider;
    }

    return telegramProvider;
}
