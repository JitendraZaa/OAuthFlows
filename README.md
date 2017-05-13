# JWT, Web Server and User Agent OAuth flow in Salesforce using Node.js

[![Youtube demo Video](https://img.youtube.com/vi/Iez9xdKbeuk/0.jpg)](https://www.youtube.com/watch?v=Iez9xdKbeuk)


# Steps to run

### Step 1
Clone this repository (Assuming Node.js already installed on system)

### Step 2
Create a ssl certificate or reuse same certificate uploaded in this repository. [Refer this post to learn how to create ssl certificate using openssl](http://www.jitendrazaa.com/blog/salesforce/use-lightning-components-on-external-websites-lightning-out/)

### Step 3
Create Connected App in your Salesforce instance with callback URL - `https://localhost:8081/oauthcallback.html`. Make sure to upload [server.crt](https://github.com/JitendraZaa/JWTDemo/blob/master/server.crt) as a digital certificate in connected app. You can use your own certificate as well.

### Step 4
Copy consumer key & secret created in connected app and update `jwt_consumer_key` and `client_secret` variable defined in [Server.js](https://github.com/JitendraZaa/JWTDemo/blob/master/Server.js) file.
 

### Step 5
Run `npm install` command in the directory where this code was downloaded. It will download all the required node modules.
Then run `npm start`, or `nodemon Server.js (if installed previously)` it will start the server

### Step 6
Navigate to `https://localhost:8081/` in your browser and you would see option for all **3 Auth flow - JWT, User Agent and Web Server**.
