import { jsonResponse } from "../../../utils/http.js";
import { getMetadata } from "../../../utils/metadata.js";
import { deleteShortLink } from "../../../utils/shortlink.js";
import { getServingProvider } from "../../../storage/index.js";

export async function onRequest(context) {
    const { env, params } = context;

    const metadata = await getMetadata(env, params.id);
    const provider = getServingProvider(params.id);

    // Remove the stored file first: dropping only the KV record would leave an R2
    // object unreachable through the dashboard but still billed as stored bytes,
    // or a Telegram channel message for a file nobody can find any more.
    //
    // When the provider says it could never delete this file (bucket binding
    // removed, or a Telegram file predating recorded message ids) the record is
    // dropped anyway, so the row cannot become permanently undeletable.
    if (!provider.canDelete(env, metadata)) {
        console.error(`Cannot delete ${params.id} from ${provider.key}: nothing to delete against, removing the record only`);
    } else {
        try {
            await provider.deleteFile(env, params.id, metadata);
        } catch (error) {
            console.error(`Failed to delete ${params.id} from ${provider.key}: ${error.message}`);

            // R2 objects cost money and are ours to remove, so a failure is
            // retryable and the record stays. A Telegram message costs the
            // deployment nothing and may already be gone, so the record goes.
            if (!provider.bestEffortDelete) {
                return jsonResponse(
                    { error: `Failed to delete the stored file: ${error.message}` },
                    { status: 500 },
                );
            }
        }
    }

    await env.img_url.delete(params.id);

    if (metadata?.shortId) {
        await deleteShortLink(env, metadata.shortId);
    }

    return jsonResponse(params.id);
}
