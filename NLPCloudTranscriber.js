const Transform = require('stream').Transform;
const NLPCloudClient = require('nlpcloud');
const { buffer } = require('stream/consumers');

/**
 * This class is responsible for transcribing base64 encoded audio files into text using the NLP Cloud API.
 * 
 * It is designed to be used with a Node stream. The transcribeStream() method returns a Node stream that can be piped to.
 * The stream will expect to receive base64 encoded audio files. It will transcribe the audio files and return the text.
 * 
 * @param {string} nlpCloundToken - the API token to use when connecting to the NLP Cloud API
 * 
 * @returns {NLPTranscriber} an instance of the NLPTranscriber class
 */
class NLPTranscriber {
    /**
     * @type {NLPCloudClient} nlpClient - the NLP Cloud client that will be used to transcribe the audio files
     */
    nlpClient;

    /**
     * @param {string} nlpCloundToken - the API token to use when connecting to the NLP Cloud API
     */
    constructor(nlpCloundToken) {
        this.nlpClient = new NLPCloudClient('whisper', nlpCloundToken, true);
    }

    /**
     * Expects to have a Node stream piped to it that contains encoded audio files.
     * @returns {Transform} a Node stream that can be piped to 
     */
    transcribeStream() {
        console.log('initializing transcriber stream...');
        return new Transform({
            transform: (chunk, encoding, callback) => {
                console.log('encoded file chunk received, transcribing...');
                this._onChunk(chunk)
                    .then(data => {
                        const error = undefined;
                        callback(error, data);
                    }).catch(err => {
                        const data = undefined;
                        callback(err, data);
                    });
            }
        });
    }

    /**
     * @param {Buffer} buffer - the encoded audio file. This should be a valid audio file such as a WAV file.
     * with a valid header followed by the audio data.
     */
    async _onChunk(buffer) {
        const chunk = buffer.toString('base64');
        let data = '[NO DATA]]';
        try {
            data = await (this.nlpClient.asr(null, chunk, 'en').then((response) => {
                if (typeof response.data === 'object' && response.data.text) {
                    return response.data.text;
                } else {
                    return '[NO DATA] - probably silence';
                }
            })
                .catch((err) => {
                    console.error(err.response.status);
                    console.error(err.response.data.detail);
                    if (err.response.status === 429 && this.rejectChunk) {
                        this.rejectChunk(buffer);
                        return '[TOO NOISY] - chunk rejected';
                    }
                }));
        } catch (err) {
            console.error(`[ERROR]: ${err}`);
        }
        return data;
    }
}

exports.NLPTranscriber = NLPTranscriber;