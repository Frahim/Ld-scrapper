// popup.js
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["isLoggedIn", "token"], (result) => {
      if (result.isLoggedIn) {
          showLoggedInState();
      } else {
          showLoggedOutState();
      }
  });
});

// Login button event listener
document.getElementById("loginButton").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
      const response = await fetch("http://127.0.0.1:8000/api/login", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
          chrome.storage.local.set({ token: data.token, isLoggedIn: true }, () => {
              console.log("Token stored successfully");
              document.getElementById("message").textContent = "Login successful!";
              showLoggedInState();
          });
      } else {
          document.getElementById("message").textContent = `Login failed: ${data.message}`;
      }
  } catch (error) {
      console.error("Login error:", error);
      document.getElementById("message").textContent = "An error occurred during login.";
  }
});

// Logout button event listener
document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
      // Clear the token and login state
      await chrome.storage.local.remove(['token', 'isLoggedIn']);
      console.log("User logged out successfully.");
      // Update UI
      document.getElementById("message").textContent = "Logged out successfully!";
      showLoggedOutState();
  } catch (error) {
      console.error("Logout error:", error);
      document.getElementById("message").textContent = "An error occurred during logout.";
  }
});

// Show the state when the user is logged in
function showLoggedInState() {
  // Hide login form elements
  document.getElementById("email").style.display = "none";
  document.getElementById("password").style.display = "none";
  document.getElementById("loginButton").style.display = "none";
  // Show logout button
  document.getElementById("logoutButton").style.display = "block";
  // Show success message
  document.getElementById("message").textContent = "You are logged in!";
  createImportButton();
  createCopyButton();
}

// Show the state when the user is logged out
function showLoggedOutState() {
  // Show login form elements
  document.getElementById("email").style.display = "block";
  document.getElementById("password").style.display = "block";
  document.getElementById("loginButton").style.display = "block";
  // Hide logout button
  document.getElementById("logoutButton").style.display = "none";
  // Clear the message
  document.getElementById("message").textContent = "Please log in.";
  // Remove import and copy buttons if they exist
  const importButton = document.getElementById("importButton");
  if (importButton) {
      importButton.remove();
  }
  const copyButton = document.getElementById("copyButton");
  if (copyButton) {
      copyButton.remove();
  }
}

// Function to create the Import button dynamically
function createImportButton() {
    if (document.getElementById("importButton")) return;
  
    const importButton = document.createElement("button");
    importButton.id = "importButton";
    importButton.textContent = "Import";
    document.body.appendChild(importButton);
  
    importButton.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
  
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ["content.js"],
          },
          () => {
            chrome.tabs.sendMessage(tabId, {
              action: "scrapeLinkedInProfile",
              context: "import",
            });
          }
        );
      });
    });
  }
  
  // Listener for scraped data from content.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendProfileDataForImport") {
      const { name, headline, ccompany, location, url } = request.profileData;
  
      const leads = [
        {
          name: name || "No Name Provided",
          headline: headline || "No Headline Provided",
          ccompany: ccompany || "No Company Provided",
          location: location || "No Location Provided",
          url: url || "No URL Provided",
        },
      ];
  
      chrome.storage.local.get(["token"], (result) => {
        const token = result.token;
        if (token) {
          importLeads(token, leads);
        } else {
          document.getElementById("message").textContent =
            "Please log in to continue importing.";
        }
      });
    }
  });
  
  async function importLeads(token, leads) {
    const existingLeads = await fetchExistingLeads(token);
  
    if (!existingLeads) {
      document.getElementById("message").textContent =
        "Error fetching existing leads.";
      return;
    }
  
    const existingUrls = existingLeads.map((l) =>
      l.url ? l.url.trim().toLowerCase() : null
    );
  
    const newLeads = leads.filter((lead) => {
      const leadUrl = lead.url?.trim().toLowerCase();
      if (!leadUrl) return false;
      return !existingUrls.includes(leadUrl);
    });
  
    if (newLeads.length === 0) {
      document.getElementById("message").textContent = "No new leads to import.";
      return;
    }
  
    const formData = new FormData();
    newLeads.forEach((lead, index) => {
      formData.append(`leads[${index}][name]`, lead.name);
      formData.append(`leads[${index}][cjobtitle]`, lead.headline);
      formData.append(`leads[${index}][ccompany]`, lead.ccompany);
      formData.append(`leads[${index}][location]`, lead.location);
      formData.append(`leads[${index}][url]`, lead.url);
    });
  
    fetch("http://127.0.0.1:8000/api/leads/import", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
      .then((response) => response.text())
      .then((data) => {
        console.log("Import Response:", data);
        document.getElementById("message").textContent =
          "Leads imported successfully!";
      })
      .catch((error) => {
        console.error("Error during lead import:", error);
        document.getElementById("message").textContent =
          "An error occurred while importing leads.";
      });
  }
  
  async function fetchExistingLeads(token) {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/leads", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
  
      if (!response.ok) throw new Error("Failed to fetch existing leads");
  
      return await response.json();
    } catch (error) {
      console.error("Error fetching existing leads:", error);
      return null;
    }
  }
  

// Listener for scraped data from the content script (for copying)
// Create a Dynamic Copy Button
function createCopyButton() {
    if (document.getElementById("copyButton")) return;
  
    const copyButton = document.createElement("button");
    copyButton.id = "copyButton";
    copyButton.textContent = "Copy";
    copyButton.style.position = "fixed";
    copyButton.style.bottom = "20px";
    copyButton.style.right = "20px";
    copyButton.style.padding = "10px 15px";
    copyButton.style.zIndex = "9999";
    document.body.appendChild(copyButton);
  
    copyButton.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
  
        // Inject content script
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ["content.js"],
          },
          () => {
            if (chrome.runtime.lastError) {
              alert("Error injecting script: " + chrome.runtime.lastError.message);
              return;
            }
  
            // Ask content script to scrape profile
            chrome.tabs.sendMessage(tabId, { action: "scrapeLinkedInProfile" }, (response) => {
              if (!response || !response.success) {
                alert("Failed to scrape profile data!");
                return;
              }
  
              const profileData = response.profileData;
  
              // Format data as TSV (or customize as needed)
              const tsvData = `${profileData.name || ''}\t${profileData.headline || ''}\t${profileData.company || ''}\t${profileData.location || ''}\t\t\t\t${profileData.url || ''}\t${profileData.copyTime || ''}`;
  
              // Inject code to copy data inside the tab context
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: (data) => {
                  const tempInput = document.createElement('textarea');
                  tempInput.value = data;
                  tempInput.setAttribute('readonly', '');
                  tempInput.style.position = 'absolute';
                  tempInput.style.left = '-9999px';
                  document.body.appendChild(tempInput);
                  tempInput.select();
                  tempInput.setSelectionRange(0, tempInput.value.length);
  
                  try {
                    const successful = document.execCommand('copy');
                    if (!successful) {
                      console.error('Failed to copy using execCommand');
                    }
                  } catch (err) {
                    console.error('Error copying to clipboard:', err);
                  } finally {
                    document.body.removeChild(tempInput);
                  }
                },
                args: [tsvData],
              }).then(() => {
                alert('Data copied to clipboard!');
              }).catch((err) => {
                alert('Failed to copy data!');
              });
            });
          }
        );
      });
    });
  }
  
  // Call this function when your page loads or when you want to show the button
  createCopyButton();
  