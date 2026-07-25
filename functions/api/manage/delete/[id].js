import { jsonResponse } from "../../../utils/http.js";
import { getMetadata } from "../../../utils/metadata.js";
import { deleteShortLink } from "../../../utils/shortlink.js";
import { getServingProvider } from "../../../storage/index.js";

export async function onRequest(context) {
    const { env, params } = context;

    const metadata = await getMetadata(env, params.id);
    const provider = getServingProvider(params.id);

    // Remove the stored file first when the backend supports it: dropping only
    // the KV record would leave an R2 object unreachable through the dashboard
    // but still billed as stored bytes.
    //
    // A binding that is gone (switched back to Telegram, say) means the object is
    // out of reach for good, so the record is dropped anyway rather than leaving
    // an undeletable row. A delete that merely fails is treated as retryable: the
    // record stays so the row remains visible and the user can try again.
    if (provider.deleteFile && !provider.canDelete(env)) {
        console.error(`Cannot delete ${params.id} from ${provider.key}: binding unavailable, removing the record only`);
    } else if (provider.deleteFile) {
        try {
            await provider.deleteFile(env, params.id);
        } catch (error) {
            console.error(`Failed to delete ${params.id} from ${provider.key}: ${error.message}`);
            return jsonResponse(
                { error: `Failed to delete the stored file: ${error.message}` },
                { status: 500 },
            );
        }
    }

    await env.img_url.delete(params.id);

    if (metadata?.shortId) {
        await deleteShortLink(env, metadata.shortId);
    }

    return jsonResponse(params.id);
}
