
var THIS_APP_ID 		= chrome.runtime.id;

var currentFocus_value 	= undefined;

var Exceptions = 
{
	BadArg 			: "Bad argument",
	BadTokenIndex	: "Bad token index",
	EncodingFailed	: "Encoding failed",
	BadFocus		: "Bad HTML element focus",
	BadTabResponse	: "Bad tab response",
	BadMsgSender	: "Unexpected message from another extension"
}

function TokenizedText(beginToken, endToken)
{
	this.begin 	= beginToken;
	this.end	= endToken;

	this.generate	= function(text)
	{
		return this.begin + text + this.end;
	}
	this.extract	= function(text)
	{
		if (text === undefined)
			throw Exceptions.BadArg;
		
		var indexOfBegin, indexOfEnd;
		if ((indexOfBegin = text.indexOf(this.begin)) != 0)
			throw Exceptions.BadTokenIndex;
		if ((indexOfEnd = text.indexOf(this.end)) == -1)
			throw Exceptions.BadTokenIndex;

			return text.substr(this.begin.length, indexOfEnd - this.begin.length);
	}
}

var TokenizedEncryptedText = new TokenizedText("AES_256_Encrypted=[", "]=Encrypted_256_AES");

//
// Inject tab script
//
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if (changeInfo.status === 'complete') {
        chrome.tabs.executeScript(tabId, {
            allFrames: true, 
            file: 'src/payload.js'
        });
    }
});

//
// Prompt password/key input
//
function getPassword()
{
	var password = undefined;

	while	(password === undefined || password.length === 0)
	{
		password = prompt(	"Enter an encryption public key\n" +
							"Password cannot be empty");
		if (password === null)
		{
			break; // canceled
		}
	}
	
	return password;
}

function encrypt(targetToEncrypt)
{
	// console.log('DEBUG : targetToEncrypt=[%o]', targetToEncrypt);

	var password = getPassword();
	if (password === undefined)
		return undefined;
	//console.log('DEBUG : password=[%o]', password);
	var encrypted = Aes.Ctr.encrypt(targetToEncrypt, password, 256);;
	//console.log('DEBUG : encrypted=[%o]', encrypted);
	var decrypted = Aes.Ctr.decrypt(encrypted, password, 256);
	//console.log('DEBUG : decrypted=[%o]', decrypted);
	if (targetToEncrypt != decrypted)
		throw Exceptions.EncodingFailed;
	
	return encrypted;
}

function decrypt(targetToDecrypt)
{
	//console.log('DEBUG : targetToDecrypt=[%o]', targetToDecrypt);
	var password = getPassword();
	if (password === undefined)
		return undefined;
	//console.log('DEBUG : password=[%o]', password);
	var decrypted = Aes.Ctr.decrypt(targetToDecrypt, password, 256);
	//console.log('DEBUG : decrypted=[%o]', decrypted);
	return decrypted;
}

//
// Encrypt the current stored (focused) value,
// and send it back to the tab
//
var onEncryptionRequest = function(info, tab, need_encapsulate)
{
	try
	{
		if (currentFocus_value === undefined)
			throw Exceptions.BadFocus;
	
		var encrypted_value	= undefined;
		var is_op_success 	= true;
		try
		{
			var encrypted_value = encrypt(currentFocus_value);
			if (encrypted_value === undefined)
				return;	// aborted
		}
		catch (exception)
		{
			console.log('[ERROR]::[onDecryptionRequest] : Exception catch : [%o]', exception);
			is_op_success = false;
		}

		chrome.tabs.query
		(
			{active: true, currentWindow: true},
			function(tabs)
			{
				if (tab.id != tabs[0].id)
					throw Exceptions.BadFocus;
	
				chrome.tabs.sendMessage(tabs[0].id,
										{	// message
											msg_id		: "mousedown_rightClick_new_element_content",
											msg_success	: is_op_success,
											msg_content : (	(need_encapsulate !== undefined && need_encapsulate === true)
															? TokenizedEncryptedText.generate(encrypted_value)
															: encrypted_value)
										},
										function(response)
										{
											if (response.msg_id != 'mousedown_rightClick_new_element_content')
												throw Exceptions.BadTabResponse;
										});
			}
		);
	}
	catch (exception)
	{
		console.log('[ERROR]::[onEncryptionRequest] : Exception catch : [%o]', exception);
		return;
	}
}

//
// Decrypt the current stored (focused) value,
// and send it back to the tab
//
var onDecryptionRequest = function(info, tab)
{
	try
	{
		if (currentFocus_value === undefined)
			throw Exceptions.BadFocus;
	
		var text = currentFocus_value;
		try
		{
			text = TokenizedEncryptedText.extract(currentFocus_value);
		}
		catch (exception)
		{
			if (exception != Exceptions.BadTokenIndex)
			{
				console.log('[ERROR]::[onAutoRequest] : Exception catch : [%o]', exception);
				return;
			}
		}
	
		var decrypted_value	= undefined;
		var is_op_success 	= true;
		try
		{
			var decrypted_value = decrypt(text);
			if (decrypted_value === undefined)
				return;	// aborted
		}
		catch (exception)
		{
			console.log('[ERROR]::[onDecryptionRequest] : Exception catch : [%o]', exception);
			is_op_success = false;
		}
		
		chrome.tabs.query
		(
			{active: true, currentWindow: true},
			function(tabs)
			{
				if (tab.id != tabs[0].id)
					throw Exceptions.BadFocus;
	
				chrome.tabs.sendMessage(tabs[0].id,
										{	// message
											msg_id		: "mousedown_rightClick_new_element_content",
											msg_success	: is_op_success,
											msg_content : decrypted_value
										},
										function(response)
										{
											if (response.msg_id != 'mousedown_rightClick_new_element_content')
												throw Exceptions.BadTabResponse;
										});
			}
		);
	}
	catch (exception)
	{
		console.log('[ERROR]::[onDecryptionRequest] : Exception catch : [%o]', exception);
		return;
	}
}

//
// Encrypt or Decrypt, depending on begin/end tokens match
//
var onAutoRequest = function(info, tab)
{
	try	// decrypt
	{
		var text = TokenizedEncryptedText.extract(currentFocus_value);
		currentFocus_value = text;
		onDecryptionRequest(info, tab);
		return;
	}
	catch (exception)
	{
		if (exception != Exceptions.BadTokenIndex)
			console.log('[ERROR]::[onAutoRequest] : Exception catch : [%o]', exception);
	}
	
	onEncryptionRequest(info, tab, /*need_encapsulate=*/true);
}

var rightClickCB_selection = function(selection)
{
	console.log('[+] : rightClickCB_selection : [%o]', selection);

	if (!selection.editable)
	{
		console.log('[WARNING] : rightClickCB_selection : Selection is not editable'); 
	}
	
	// selection.selectionText = 'replaced !';
	
	// onEncryptionRequest();
};

//
//	A new focus is notified (mousedown_rightClick)
//
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

	try
	{
		if (!(sender.tab) || sender.id !== THIS_APP_ID)
			throw Exceptions.BadMsgSender;
	
		// console.log("[+] : Message from : [%o] :\n\t |- [%o]", sender.tab.url, request);
		if (request.msg_id == "mousedown_rightClick")
		{
			currentFocus_value = request.msg_content;
			sendResponse
			(
				{	// message
					msg_id 			: "mousedown_rightClick",
					msg_response 	: 'done'
				}
			);
		}
	}
	catch (exception)
	{
		console.log('[ERROR]::[OnMessageListener] : Exception catch : [%o]', exception);
		return;
	}
});

// chrome.contextMenus.create(
// {
	// title: "Encrypt : selection",
	// contexts:["selection"],
	// id : "id_EncryptSelection",
	// onclick: rightClickCB_selection
// });

chrome.contextMenus.create(
{
	title: "Auto",
	contexts:["editable"],
	id : "id_AutoEditable",
	onclick: onAutoRequest
});
chrome.contextMenus.create(
{
	title: "Encrypt",
	contexts:["editable"],
	id : "id_EncryptEditable",
	onclick: onEncryptionRequest
});
chrome.contextMenus.create(
{
	title: "Decrypt",
	contexts:["editable"],
	id : "id_DecryptEditable",
	onclick: onDecryptionRequest
});




