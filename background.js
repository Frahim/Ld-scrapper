// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "copyToClipboard") {
      const textToCopy = request.data;
      navigator.clipboard.writeText(textToCopy).then(
        () => {
          sendResponse({ success: true });
        },
        (err) => {
          console.error('Failed to copy: ', err);
          sendResponse({ success: false });
        }
      );
      // Important:  Return true to indicate that the response will be sent asynchronously.
      return true;
    }
  });
  