const DEFAULT_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
// Workers AI receives the raw bytes, so the file does not need to be publicly
// reachable — this also sidesteps the dead telegra.ph URL the legacy provider
// depends on. Oversized bodies are skipped instead of buffered.
const MAX_MODERATED_BYTES = 5 * 1024 * 1024;
const PROMPT = 'Does this image contain explicit sexual or pornographic content? Answer with exactly one word: yes or no.';
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|bmp|avif|apng)$/i;

export const cloudflareAiProvider = {
    key: 'cloudflare-ai',

    async moderate(env, { fileId, response }) {
        if (!env.AI) {
            console.error('cloudflare-ai moderation selected but no AI binding is configured');
            return null;
        }

        if (!looksLikeImage(response, fileId)) {
            return null;
        }

        const buffer = await response.clone().arrayBuffer();
        if (buffer.byteLength === 0 || buffer.byteLength > MAX_MODERATED_BYTES) {
            return null;
        }

        const model = env.MODERATION_AI_MODEL || DEFAULT_MODEL;
        const result = await env.AI.run(model, {
            image: [...new Uint8Array(buffer)],
            prompt: PROMPT,
            max_tokens: 20,
        });

        const answer = String(result?.description ?? result?.response ?? '').trim().toLowerCase();
        if (!answer) {
            return null;
        }

        return /\byes\b/.test(answer) ? 'adult' : 'everyone';
    },
};

function looksLikeImage(response, fileId) {
    const contentType = response.headers.get('Content-Type') || '';
    return contentType.startsWith('image/') || IMAGE_EXTENSION_PATTERN.test(String(fileId));
}
