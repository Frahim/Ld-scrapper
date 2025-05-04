// popup.js
document.addEventListener('DOMContentLoaded', () => {
  // On popup open, check if already logged in
  chrome.storage.local.get('token', (result) => {
    if (result.token) {
      // Already logged in
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('copySection').style.display = 'block';
     // document.getElementById('importSection').style.display = 'block';
    } else {
      // Not logged in
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('copySection').style.display = 'none';
     // document.getElementById('importSection').style.display = 'none';
    }
  });

  // --- Utility Functions ---
  /**
   * Displays a message to the user.
   * @param {string} message - The message to display.
   * @param {boolean} isError - If true, displays the message as an error.
   */
  function showMessage(message, isError = false) {
    const messageElement = document.getElementById('messageDisplay');
    if (!messageElement) {
      console.error('Error: messageDisplay element not found in popup.html');
      return;
    }
    messageElement.textContent = message;
    messageElement.style.color = isError ? 'red' : 'green';
    messageElement.style.padding = '8px';
    messageElement.style.marginTop = '8px';
    messageElement.style.border = isError ? '1px solid red' : '1px solid green';
    messageElement.style.borderRadius = '4px';
    messageElement.style.backgroundColor = isError ? '#ffe0e0' : '#e0ffe0';
  }

  // Login button
  document.getElementById('loginButton').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
      showMessage("Please enter email and password.", true);
      return;
    }

    try {
      const response = await fetch('http://e1leads.agrilfoods.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        chrome.storage.local.set({ token: data.token }, () => {
          document.getElementById('loginForm').style.display = 'none';
          document.getElementById('copySection').style.display = 'block';
          showMessage('Logged in successfully!');
        });
      } else {
        showMessage("Login failed!", true);
      }
    } catch (error) {
      console.error('Login Error:', error);
      showMessage("Error connecting to server.", true);
    }
  });

  // Copy button
  document.getElementById('copyButton').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;

      // Execute content.js to scrape data
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: ["content.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            showMessage("Error injecting script: " + chrome.runtime.lastError.message, true);
            return;
          }
          chrome.tabs.sendMessage(tabId, { action: "scrapeLinkedInProfile" }, (response) => {
            if (!response) {
              showMessage("Failed to get response from content script.", true);
              return;
            }
            if (response.success) {
              const profileData = response.profileData;

              // Format data as tab-separated values (TSV)
              const tsvData = `${profileData.name}\t${profileData.headline}\t${profileData.company}\t${profileData.location}\t\t\t\t${profileData.url}\t${profileData.copyTime}`;

              // Use chrome.scripting.executeScript to copy to clipboard
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: (data) => {
                  // Create a temporary input element
                  const tempInput = document.createElement('textarea');
                  tempInput.value = data;
                  tempInput.setAttribute('readonly', '');
                  tempInput.style.position = 'absolute';
                  tempInput.style.left = '-9999px';
                  document.body.appendChild(tempInput);

                  // Select the text
                  tempInput.select();
                  tempInput.setSelectionRange(0, tempInput.value.length);

                  try {
                    const successful = document.execCommand('copy');
                    if (!successful) {
                      console.error('content.js: Failed to copy using execCommand');
                    }
                  } catch (err) {
                    console.error('content.js: Error copying to clipboard:', err);
                  } finally {
                    document.body.removeChild(tempInput);
                  }
                },
                args: [tsvData],
              }).then(() => {
                showMessage('Data copied to clipboard!');
              }).catch((err) => {
                showMessage('Failed to copy data!', true);
              });
            } else {
              showMessage('Failed to scrape data!', true);
            }
          });
        }
      );
    });
  });
});
