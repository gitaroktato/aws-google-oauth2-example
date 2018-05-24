function authenticate(googleUser) {
    getIdToken(googleUser)
        .then(AWSSTSSignIn)
        .then(handleSTSResponse)
        .then(signHttpRequest)
        .then(getSigninTokenFromLambda)
        .then(redirectToManagementConsole)
        .catch(handleError);
};

function getIdToken(googleUser) {
    // Useful data for your client-side scripts:
    var profile = googleUser.getBasicProfile();
    // Profile ID can be used in IAM roles for authorization by using accounts.google.com:sub
    console.log("Google ID: " + profile.getId());
    // The ID token needed for web identity authentication:
    var idToken = googleUser.getAuthResponse().id_token;
    console.log("Google ID Token: " + idToken);
    return new Promise(function (resolve) {
        resolve(idToken);
    });
}

function AWSSTSSignIn(idToken) {
    var sts = new AWS.STS();
    var params = {
        RoleArn: window.config.roleArn, /* required */
        RoleSessionName: "AssumeRoleSession", /* required */
        WebIdentityToken: idToken /* required */
    };
    return new Promise(function (resolve, reject) {
        sts.assumeRoleWithWebIdentity(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                // Returning STS response
                console.log("STS credentials: " + JSON.stringify(data.Credentials));
                resolve(data);
            }
        });
    });
}

function handleSTSResponse(data) {
    // Setting AWS config credentials globally
    AWS.config.credentials = new AWS.Credentials(
        data.Credentials.AccessKeyId,
        data.Credentials.SecretAccessKey,
        data.Credentials.SessionToken);
    AWS.config.region = window.config.region;
    // Sending sign-in parameters to lambda function
    var signInParameters = {
        "sessionId": data.Credentials.AccessKeyId,
        "sessionKey": data.Credentials.SecretAccessKey,
        "sessionToken": data.Credentials.SessionToken
    };
    return new Promise(function (resolve) {
        resolve(signInParameters);
    })
}

function signHttpRequest(signInParameters) {
    var signInUrl = "https://";
    signInUrl += window.config.apiGatewayUrl
    signInUrl += window.config.apiGatewayPath;
    // Setting AWS Signed header
    var request = new AWS.HttpRequest(window.config.apiGatewayUrl, window.config.region);
    request.method = 'POST';
    request.path = window.config.apiGatewayPath;
    request.body = JSON.stringify(signInParameters);
    // Needed for proper signature generation
    request.headers['Host'] = request.endpoint.host;
    // Signing
    var signer = new AWS.Signers.V4(request, 'execute-api');
    signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate());
    return new Promise(function (resolve) {
        resolve(signer.request);
    });
}

function getSigninTokenFromLambda(request) {
    return new Promise(function (resolve, reject) {
        AWS.util.defer(function () {
            var data = '';
            var http = AWS.HttpClient.getInstance();
            http.handleRequest(request, {}, function (httpResponse) {
                httpResponse.on('data', function (chunk) {
                    data += chunk.toString();
                });
                httpResponse.on('end', function () {
                    console.log("Sign-in token from Lambda: " + data);
                    resolve(data);
                });
            }, reject);
        });
    });
}

function redirectToManagementConsole(data) {
    var signin_token = JSON.parse(data);
    var request_parameters = "?Action=login"
    request_parameters += "&Issuer=Example.org"
    request_parameters += "&Destination=" + encodeURIComponent("https://console.aws.amazon.com/")
    request_parameters += "&SigninToken=" + signin_token.SigninToken;
    var request_url = "https://signin.aws.amazon.com/federation" + request_parameters;
    window.location.replace(request_url);
}

function handleError(error) {
    console.log("Authentication failed: " + error);
}