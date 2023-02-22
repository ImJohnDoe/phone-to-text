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

/**
 * This is the endpoint that Twilio will send the media to.
 * This endpoint will be called when a call is connected and will be called for each chunk of media that is sent.
 * To wire this up add a TwiML app to your Twilio account and set the Voice URL to this endpoint.
 * 
 * https://console.twilio.com/us1/develop/twiml-bins/twiml-bins
 * example of a TwiML app:
 * <?xml version="1.0" encoding="UTF-8"?>
 * <Response>
 * <Start>
 *     <Stream url="wss://****-**-**-**-****.ngrok.io/media" />
 * </Start>
 * <Say>
 *     Connected to Socket, about to wait for a bit.
 * </Say>
 * <Pause length="20" />
 * <Say>
 *     All done waiting. Good bye.
 * </Say>
 * </Response>
 * 
 * After you have created the TwiML app, you can use it in a Twilio phone number.
 * https://www.twilio.com/console/phone-numbers/incoming
 * 
 * Set the TwiML app to run when a call comes in.
 */
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


