'use strict';
const https = require('https');

// Lambda gets sign-in token from AWS and returns token to caller.
exports.handler = (event, context, callback) => {

    var request_url = buildRequestURL(event);
    console.log("Request URL: " + request_url);
    // Sending the request
    https.get(request_url, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        // The whole response has been received.
        resp.on('end', () => {
            console.log("Response data from AWS: " + data);
            // Sending back the response to caller
            var response = buildResponse(data);
            callback(null, response);
        });

    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

function buildResponse(data) {
    return {
        statusCode: 200,
        // We have to include this header for cross-origin calls
        headers: { "Access-Control-Allow-Origin": "*" },
        body: data
    };
}

function buildRequestURL(event) {
    var request = JSON.parse(event.body);
    var request_parameters = "?Action=getSigninToken";
    request_parameters += "&SessionDuration=43200";
    request_parameters += "&Session=" + encodeURIComponent(JSON.stringify(request));
    var request_url = "https://signin.aws.amazon.com/federation" + request_parameters;
    return request_url;
}

