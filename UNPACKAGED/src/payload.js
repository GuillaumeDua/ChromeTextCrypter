
var THIS_APP_ID = chrome.i18n.getMessage("@@extension_id");

var Exceptions =
{
	BadFocus				: "Bad HTML element focus",
	NotEncryptableElement	: "This element cannot be encrypted",
	BadAppResponse			: "Bad application response",
	BadMsgSender			: "Unexpected message from another extension"
}
var Warnings =
{
	MsgDuplicated 			: "useless duplicate message aborted"
}

var clicked = 
{
	_tagName 	: '',
	_text		: '',
	_elem		: undefined,
	
	Load		: function(htmlElem)
	{
		if (	htmlElem 			=== undefined
			|| 	htmlElem 			=== null
			|| 	htmlElem.tagName 	=== undefined)
			throw BadFocus;

		this._elem 		= htmlElem;
		this._tagName 	= htmlElem.tagName.toLowerCase();
		
		// console.log("[INFO] : clicked : element's tagName=[%o]", this._tagName);
		
		if (	this._tagName === 'input'
			|| 	this._tagName === 'textarea')
		{
			this._text = htmlElem.value;
		}
		else if (htmlElem.innerText != undefined)
		{
			// GMail
			// if (	this._tagName == 'div'
				// && 	this._elem.parentNode.class 					!== undefined
				// && 	this._elem.parentNode.class.indexOf('editable')	!== -1
				// && 	this._elem.parentNode.innerText					!== undefined)
			// {
				// this._elem = this._elem.parentNode;
				// this._text = this._elem.innerText;
			// }
			// else
			this._text = htmlElem.innerText;
		}
		else
		{
			alert('[Error] : This element cannot be encrypted');
			throw Exceptions.NotEncryptableElement;
		}
		// console.log("[INFO] : clicked : element's text=[%o]", this._text);
	},
	
	SetNewText	: function(newText)
	{
		if (	this._tagName === 'input'
			|| 	this._tagName === 'textarea')
		{
			this._elem.value = newText;
		}
		else if (this._elem.innerText != undefined)
		{
			this._elem.innerText = newText;
		}
		else
			throw Exceptions.NotEncryptableElement;
	}
};

//
// Send mousedown information
//
document.addEventListener("mousedown", function(event) {
    
	try
	{
		if (event.button == 2)	//right click
		{ 
			clicked.Load(event.target);
			// console.log('sending : [%o]', clicked._text);
			chrome.runtime.sendMessage
			(
				{	// message
					msg_id		: "mousedown_rightClick",
					msg_content : clicked._text
				},
				function(response)
				{
					if (response.msg_id != 'mousedown_rightClick')
						throw Exceptions.BadAppResponse;
					console.log('DEBUG : [%o]', response);
					// if (response.msg_success !== true)
						// alert('Application operation failed (focus)');
				}
			);
		}
	}
	catch (exception)
	{
		console.log('[ERROR]::[mousedown_rightClick] : Exception catch : [%o]', exception);
		return;
	}
}, true);

//
// Set focused element new content
//
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

	try
	{
		if (clicked._elem === undefined || clicked._elem === null) // WTF ?
			throw Warnings.MsgDuplicated;
		if (sender.id !== THIS_APP_ID)
			throw Exceptions.BadMsgSender;
	
		if (request.msg_id == "mousedown_rightClick_new_element_content")
		{
			if (request.msg_success !== undefined &&
				request.msg_success !== true)
			{
				alert('Application operation failed : encrypt/decrypt');
				return;
			}
		
			// console.log('request (encrypted) : [' + request.msg_content + ']');
			var response =
			{	// message
				msg_id		: 'mousedown_rightClick_new_element_content',
				msg_content	: 'done'
			};
			
			try
			{
				clicked.SetNewText(request.msg_content);
			}
			catch (exception)
			{
				console.log('[ERROR]::[OnMessageListener] : Exception catch while setting HTML element : [%o]', exception);
				response.msg_content = 'failed';
			}
			sendResponse(response);
		}
	}
	catch (exception)
	{
		if (exception !== undefined)
			console.log('[ERROR]::[OnMessageListener] : Exception catch : [%o]', exception);
	}
});

//
// TODO : Selection
//
// window.getSelection()
// chrome.extension.sendRequest