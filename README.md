# phone-to-text

This express app exposes a web socket endpoint at `/media`. This is the endpoint that Twilio streams audio to. The audio is then sent to the [NLP Cloud](https://www.nlpcloud.io/) service for transcription. It's fast enough to transcribe a call in real time and act on the transcription within the call.

## Requirements

You will need a [Twilio account](https://www.twilio.com/try-twilio) to use this app.

You will also need to set up a [Twilio phone number](https://www.twilio.com/console/phone-numbers/incoming) to be able to make a call.

Finally, you will need to install [ngrok](https://ngrok.com/) to expose your local server to the internet.

## Setup

1. Clone this repo
2. Run `npm install`
3. create a `.env` file in the root of the project and add the following:
```
NLP_CLOUD_TOKEN=your_nlp_cloud_token
```
4. Run `npm start`
5. Run `ngrok http 8080` to expose your local server to the internet (you can use any port you want, but you will need to change the port in the ngrok command and in the TwiML app).
6. Create a TwiML app and set the Voice URL to the ngrok url.
7. Set the TwiML app to run when a call comes in.
8. Call your Twilio phone number.

You should receive a text message with the transcription of the call.

## Details

To tell Twilio about this endpoint create a [TwiML bin](https://console.twilio.com/us1/develop/twiml-bins/twiml-bins) and set the Voice URL to this endpoint.

example of a TwiML app:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Start>
    <Stream url="wss://****-**-**-**-****.ngrok.io/media" />
</Start>
<Say>
    Connected to Socket, about to wait for a bit.
</Say>
<Pause length="20" />
<Say>
    All done waiting. Good bye.
</Say>
</Response>
```

After you have created the TwiML app, you can use it in a Twilio phone number.
https://www.twilio.com/console/phone-numbers/incoming

Set the TwiML app to run when a call comes in.

## License

MIT - This is free software. Feel free to modify and redistribute it. If you find it useful, please consider giving it a star on GitHub.

## Contributing

If you would like to contribute to this project, please fork the repo and submit a pull request.

## Author
https://twitter.com/romechenko