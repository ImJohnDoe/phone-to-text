const Transform = require('stream').Transform;
const NLPCloudClient = require('nlpcloud');
const { buffer } = require('stream/consumers');

/**
 * This class is responsible for transcribing base64 encoded audio files into text using the NLP Cloud API.
 * 
 * @param {string} nlpCloundToken - the API token to use when connecting to the NLP Cloud API
 */
class NlpCloudTranscriber {
    /**
     * @param {string} nlpCloundToken - the API token to use when connecting to the NLP Cloud API
     * @param {boolean} printDebug - whether or not to print debug messages to the console
     */
    constructor(nlpCloundToken, printDebug = false) {
        /**
         * @type {NLPCloudClient} nlpClient - the NLP Cloud client that will be used to transcribe the audio files
         */
        this.nlpClient = new NLPCloudClient('whisper', nlpCloundToken, true);

        /**
         * @type {boolean} printDebug - whether or not to print debug messages to the console
         */
        this.printDebug = printDebug;
    }

    /**
     * @param {Buffer} buffer - the encoded audio file. This should be a valid audio file such as a WAV file.
     * with a valid header followed by the audio data.
     */
    async transcribeFile(buffer) {
        const chunk = buffer.toString('base64');
        return await this.nlpClient.asr(null, chunk, 'en')
            .then((response) => {
                return response.data.text;
            })
            .catch((err) => {
                this.printDebug ? console.error(err.response.status) : null;
                this.printDebug ? console.error(err.response.data.detail) : null;
                return '[ERROR: ${err.response.status}]';
            });
    }
}

exports.NlpCloudTranscriber = NlpCloudTranscriber;