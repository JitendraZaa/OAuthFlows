var $apiEle = $("#apiCount"), 
proxyURL = 'https://localhost:8081/proxy/'; 

var client = new forcetk.Client('', '', proxyURL);
 
if($.cookie("AccToken") && $.cookie("APIVer") && $.cookie("InstURL"))
{ 
    client.setSessionToken($.cookie("AccToken"), $.cookie("APIVer"), $.cookie("InstURL"));
	getLoggedInUserInfo();
	executeQuery();
}else{
	$('#result').html('Some issue occurred during authentication. Please contact admin or try again by <a href="index.html">navigating here</a>.');
}

$('#Query-to-execute').keypress(function (e) {
 var key = e.which;
 if(key == 13)  // the enter key code
  { 
	executeQuery();
  }
}); 

function getLoggedInUserInfo()
{
    var url = $.cookie("idURL"); 
	
    client.ajax(url,
                 function(data){ 
                     $("#loggedInUser").html(data.display_name) ; 
                 },
                  function (error){
                      console.log(error);
                  },
                  'GET',
                   '',
                   true
                );
 
}
 
 function executeQuery() {
    if (!client.sessionId) {
        $('#result').html('You are not authenticated. Please login first.');
        return false;
    }
    client.query($("#Query-to-execute").val(),
        function (data) {
            $('#result').html(JSON.stringify(data, undefined, 3));
        },
        function (error) {
            $('#result').html("Error: " + JSON.stringify(error));
        });
    return false;
}


function addAPICount()
{
    if(!$apiEle)
    {
        $apiEle = $("#apiCount");
    }
    
    $apiEle.text(parseInt($apiEle.text()) + 1) ; 
} 
