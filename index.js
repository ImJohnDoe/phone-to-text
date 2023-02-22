require('dotenv').config();
const express = require('express');
const expressWebSocket = require('express-ws');
const websocketStream = require('websocket-stream/stream');

const { TwilioWavFileBuilder } = require("./TwilioWavFileBuilder.js");
const { NLPTranscriber } = require("./NLPCloudTranscriber.js");

const PORT = 8080;
const nlpCloundToken = process.env.NLP_CLOUD_TOKEN;

const app = express();

// extend express app with app.ws()
expressWebSocket(app, null, {
    perMessageDeflate: false,
});

app.ws("/media", (ws, req) => {
    // Wrap the websocket in a Node stream
    const mediaStream = websocketStream(ws);

    console.log('New WebSocket connection');

    const wavBuilder = new TwilioWavFileBuilder();
    const nlpTranscriber = new NLPTranscriber(nlpCloundToken);

    mediaStream
        .pipe(wavBuilder.chunkTwilioIntoWavChunks())
        .pipe(nlpTranscriber.transcribeStream())
        .on('data', msg => {
            console.log(`[GOT MSG]: ${msg}`);
        });
});

console.log(`Listening for Twilio Voice Media WebSocket Connections on port ${PORT}`);
app.listen(PORT);


