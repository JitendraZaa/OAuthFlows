var express = require('express'),
    http = require('http'), 
    request = require('request'),
    bodyParser = require('body-parser'),
	morgan = require('morgan'),
    app = express(), 
	path = require("path"),
	https = require('https'), 
	fs = require('fs'),  
	base64url = require('base64-url'), 
	nJwt = require('njwt'),  
	apiVersion = 'v38.0',
	domainName='localhost:8081',
	jwt_consumer_key = '3MVG9n_HvETGhr3D_K58a1146EmiqvI3U03IuPq8_LUpKFOviLMNYkEDOFiQjLNKsmKNWSbY9veI1gXrR0Eaa', 
	consumer_secret='76E4EA0EB22E0B673B3781B3E64AAF0C7D97885D735C631D9BACFA6A4B2E83B5',
	jwt_aud = 'https://login.salesforce.com', 
	callbackURL='https://localhost:8081/oauthcallback.html';

	qrcode = require('qrcode-npm'),
    decode = require('salesforce-signed-request'),
	canvas_consumer_secret='CB61ED01EA3693777FA4E403D6B775FCD94A9971FBCXXX89F25EA75383ACCCD9E69';
 
	app.set('view engine', 'ejs'); 

app.use(express.static(__dirname + '/client')); 
 
app.use(morgan('dev'));
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded({extended : true}));

app.set('port', process.env.PORT || 8080);

app.post('', function (req,res){

});

app.post('/signedrequest', function(req, res) {
    // You could save this information in the user session if needed
    var signedRequest = decode(req.body.signed_request, canvas_consumer_secret),
        context = signedRequest.context,
        oauthToken = signedRequest.client.oauthToken,
        instanceUrl = signedRequest.client.instanceUrl; 

		contactRequest = creatContactQuery(oauthToken,context,instanceUrl);  

    request(contactRequest, function(err, response, body) {
		var imgTag = getQRCode(JSON.parse(body).records[0]); 
        res.render('canvasSignedReq', {context: context, imgTag: imgTag, canvasMode : "Authentication - Signed Request"});
    });

});

function getQRCode(contact){
	var qr = qrcode.qrcode(4, 'L'), 
            text = 'MECARD:N:' + contact.LastName + ',' + contact.FirstName + ';TEL:' + contact.Phone + ';EMAIL:' + contact.Email + ';;';
        qr.addData(text);
        qr.make();
        return qr.createImgTag(4);
}

function creatContactQuery(oauthToken,context,instanceUrl){
	query = "SELECT Id, FirstName, LastName, Phone, Email FROM Contact WHERE Id = '" + context.environment.record.Id + "'",

	contactRequest = {
		url: instanceUrl + '/services/data/v29.0/query?q=' + query,
		headers: {
			'Authorization': 'OAuth ' + oauthToken
		}
	};
	return contactRequest;
}

/**
 *  Extract Access token from POST response and redirect to page Main
 */
function extractAccessToken(err, remoteResponse, remoteBody,res){
	if (err) { 
		return res.status(500).end('Error'); 
	}
	console.log('remotebody');
	console.log(remoteBody) ;
	var sfdcResponse = JSON.parse(remoteBody); 
	console.log('sfdcResponse');
	console.log(sfdcResponse) ;
	
	//success
	if(sfdcResponse.access_token){				 
		res.writeHead(302, {
		  'Location': 'Main' ,
		  'Set-Cookie': ['AccToken='+sfdcResponse.access_token,'APIVer='+apiVersion,'InstURL='+sfdcResponse.instance_url,'idURL='+sfdcResponse.id]
		});
	}else{
		res.write('Some error occurred. Make sure connected app is approved previously if its JWT flow, Username and Password is correct if its Password flow. ');
		res.write(' Salesforce Response : ');
		res.write( remoteBody ); 
	} 
	res.end();
}

app.all('/proxy',  function(req, res) {     
    var url = req.header('SalesforceProxy-Endpoint');  
    request({ url: url, method: req.method, json: req.body, 
                    headers: {'Authorization': req.header('X-Authorization'), 'Content-Type' : 'application/json'}, body:req.body }).pipe(res); 
});

app.get('/jwt', function (req,res){  
	var isSandbox = req.query.isSandbox;
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/token' ;
	if(isSandbox == 'true'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/token' ;
	}
	var sfdcUserName = req.query.jwtUserName;
	var token = getJWTSignedToken_nJWTLib(sfdcUserName); 
	  
	var paramBody = 'grant_type='+base64url.escape('urn:ietf:params:oauth:grant-type:jwt-bearer')+'&assertion='+token ;	
	var req_sfdcOpts = { 	url : sfdcURL,  
							method:'POST', 
							headers: { 'Content-Type' : 'application/x-www-form-urlencoded'} ,
							body:paramBody 
						};
				
	request(req_sfdcOpts, 
		function(err, remoteResponse, remoteBody) {
			extractAccessToken(err, remoteResponse, remoteBody, res); 
		} 
	); 
} );

/**
 * Step 1 Web Server Flow - Get Code
 * code_challenge and code_verifier are used for PKCE
 */
app.get('/webServer', function (req,res){  
	var isSandbox = req.query.isSandbox;
	var state = 'webServerProd';
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/authorize' ;
	if(isSandbox == 'true'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/authorize' ;
		state = 'webServerSandbox';
	}
	
	 request({ 	url : sfdcURL+'?client_id='+
				 jwt_consumer_key+'&redirect_uri='+
				 callbackURL+'&response_type=code&state='+state,  
				method:'GET' 
			}).pipe(res);
	 
} );



/**
 * Step 2 Web Server Flow - Get token from Code
 */
app.get('/webServerStep2', function (req,res){  
	var state = req.query.state;
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/token' ;
	if(state == 'webServerSandbox'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/token' ;
	}
	
	 request({ 	url : sfdcURL+'?client_id='+
				 jwt_consumer_key+'&redirect_uri='+
				 callbackURL+'&grant_type=authorization_code&code='+
				 req.query.code+'&client_secret'+consumer_secret,  
				method:'POST' 
			},
			function(err, remoteResponse, remoteBody) {
				extractAccessToken(err, remoteResponse, remoteBody, res); 
			} 
		);
	 
} );


/**
*	 User Agent oAuth Flow
*/
app.get('/uAgent', function (req,res){  
	var isSandbox = req.query.isSandbox;
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/authorize' ;
	if(isSandbox == 'true'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/authorize' ;
	}
	
	 request({ 	url : sfdcURL+'?client_id='+jwt_consumer_key+'&redirect_uri='+callbackURL+'&response_type=token',  
				method:'GET' 
			}).pipe(res); 
	 
} );

/**
*	 Client Credentials Flow - By Sneha Kashyap
*/
app.get('/ccf', function (req,res){  
	
	var isSandbox = req.query.isSandbox;
	var myDomainUrl = req.query.myDomainUrl;
	var sfdcURL = myDomainUrl+'/services/oauth2/token' ;
	if(isSandbox == 'true'){
		sfdcURL = myDomainUrl+'/services/oauth2/token' ;
	}
	
	 request({ 		url : sfdcURL+'?grant_type=client_credentials'
	 				+'&client_id='+jwt_consumer_key+
					'&client_secret='+consumer_secret,  
					method:'POST' 
			},
			function(err, remoteResponse, remoteBody) {
				extractAccessToken(err, remoteResponse, remoteBody, res); 
			}
			); 
	 
} );

/**
*	 Username Password oAuth Flow
*/
app.post('/uPwd', function (req,res){  

	var instance = req.body.instance;
	var uname = req.body.sfdcUsername;
	var pwd = req.body.sfdcPassword; 

	var state = req.query.state;
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/token' ;
	if(instance == 'sand'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/token' ;
	}
	
	var computedURL = sfdcURL+
	'?client_id='+ jwt_consumer_key+
	 '&grant_type=password'+
	 '&client_secret='+consumer_secret+
	 '&username='+uname+
	 '&password='+pwd ;
    console.log('computedURL ');
	console.log(computedURL);

	 request({ 	url : computedURL,  
				method:'POST' 
			},
			function(err, remoteResponse, remoteBody) {
				extractAccessToken(err, remoteResponse, remoteBody, res); 
			} 
		);  
} );

/**
 * Device Authentication Flow
 */
app.get('/device', function (req,res){  

	var isSandbox = req.query.isSandbox;
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/token' ;
	if(isSandbox == 'true'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/token' ;
	}
	
	var computedURL = sfdcURL+
	'?client_id='+ jwt_consumer_key+
	 '&response_type=device_code' ;
 

	 request({ 	url : computedURL,  
				method:'POST' 
			},
			function(err, remoteResponse, remoteBody) {
				if (err) { 
					res.write(err);
					res.end();
					//return res.status(500).end('Error'); 
					return  ;
				}
				console.log(remoteBody) ;
				var sfdcResponse = JSON.parse(remoteBody); 

				if(sfdcResponse.verification_uri){
					res.render('deviceOAuth',{
						verification_uri : sfdcResponse.verification_uri,
						user_code : sfdcResponse.user_code,
						device_code : sfdcResponse.device_code,
						isSandbox : isSandbox
					}); 
				}  
			} 
		);  
} ); 

/**
 *  Keep polling till device is verified using code
 */

app.get('/devicePol', function (req,res){  

	var isSandbox = req.query.isSandbox;
	var verification_uri = req.query.verification_uri;
	var user_code = req.query.user_code;
	var device_code = req.query.device_code;

	var sfdcURL = 'https://login.salesforce.com/services/oauth2/token' ;
	if(isSandbox == 'true'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/token' ;
	}
	
	var computedURL = sfdcURL+
	'?client_id='+ jwt_consumer_key+
	 '&grant_type=device'+
	 '&code='+device_code ;

	 request({ 	url : computedURL,  
			method:'POST' 
		},
		function(err, remoteResponse, remoteBody) {
			if (err) { 
				return res.status(500).end('Error'); 
			}
			console.log(remoteBody) ;
			var sfdcResponse = JSON.parse(remoteBody); 

			if(sfdcResponse.access_token){ 
				res.writeHead(302, {
					'Location': 'Main' ,
					'Set-Cookie': ['AccToken='+sfdcResponse.access_token,'APIVer='+apiVersion,'InstURL='+sfdcResponse.instance_url,'idURL='+sfdcResponse.id]
				  });
				  res.end();
			} else{
				res.render('deviceOAuth',{
					verification_uri :  verification_uri,
					user_code :  user_code,
					device_code :  device_code,
					isSandbox : isSandbox
				});
			}
		} 
	);  
} ); 

 

function getJWTSignedToken_nJWTLib(sfdcUserName){ 
	var claims = {
	  iss: jwt_consumer_key,   
	  sub: sfdcUserName,     
	  aud: jwt_aud,
	  exp : (Math.floor(Date.now() / 1000) + (60*3))
	}

	return encryptUsingPrivateKey_nJWTLib(claims);
}

function encryptUsingPrivateKey_nJWTLib (claims) {
	var absolutePath = path.resolve("key.pem"); 	
    var cert = fs.readFileSync(absolutePath );	
	var jwt_token = nJwt.create(claims,cert,'RS256');	
	console.log(jwt_token);	
	var jwt_token_b64 = jwt_token.compact();
	console.log(jwt_token_b64);
 
	return jwt_token_b64;     
}; 


app.get('/' ,  function(req,res) {
    res.sendfile('views/index.html');
} ); 

app.get('/index*' ,  function(req,res) {
    res.sendfile('views/index.html');
} );  
 
app.get('/oauthcallback.html' ,  function(req,res) {
    res.sendfile('views/oauthcallback.html');
} ); 

app.get('/Main*' ,   function(req,res) {
    res.sendfile('views/Main.html');
} );
  
app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

var options = {
  key: fs.readFileSync('./key.pem', 'utf8'),
  cert: fs.readFileSync('./server.crt', 'utf8')
};

https.createServer(options, app).listen(8081);
console.log("Server listening for HTTPS connections on port ", 8081);