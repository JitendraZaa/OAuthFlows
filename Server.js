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
	jwt_consumer_key = '3MVG9szVa2RxsqBYmpkiG1QgjELvD9Z0NRvySRZKne.sBmUyKr9jPLaKWxAlFr3vvGGUGQskU3c.QPQyQuOel', 
	consumer_secret='4390324792281178734',
	jwt_aud = 'https://login.salesforce.com', 
	callbackURL='https://localhost:8081/oauthcallback.html';

   
app.use(express.static(__dirname + '/client')); 
 
app.use(morgan('dev'));
app.use(bodyParser.json());  

app.set('port', process.env.PORT || 8080);

/**
 *  Extract Access token from POST response and redirect to page Main
 */
function extractAccessToken(err, remoteResponse, remoteBody,res){
	if (err) { 
		return res.status(500).end('Error'); 
	}
	console.log(remoteBody) ;
	var sfdcResponse = JSON.parse(remoteBody); 
	
	//success
	if(sfdcResponse.access_token){				 
		res.writeHead(302, {
		  'Location': 'Main' ,
		  'Set-Cookie': ['AccToken='+sfdcResponse.access_token,'APIVer='+apiVersion,'InstURL='+sfdcResponse.instance_url,'idURL='+sfdcResponse.id]
		});
	}else{
		res.write('Some error occurred. Make sure connected app is approved previously. ');
		res.write('Salesforce Response : ');
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
*	 User Agent flow oAuth Flow
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
    //return base64url.encode(token);   
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