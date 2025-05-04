// popup.js
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["isLoggedIn", "token"], (result) => {
        if (result.isLoggedIn) {
            showLoggedInState();
            createImportButtonOnce(); // Call the new function
            createCopyButtonOnce();   // Call the new function
        } else {
            showLoggedOutState();
        }
    });
});
// Login button event listener
document.getElementById("loginButton").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const messageElement = document.getElementById("message");

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
                messageElement.textContent = "Login successful!";
                showLoggedInState();
            });
        } else {
            messageElement.textContent = `Login failed: ${data.message}`;
        }
    } catch (error) {
        console.error("Login error:", error);
        messageElement.textContent = "An error occurred during login.";
    }
});

// Logout button event listener
document.getElementById("logoutButton").addEventListener("click", async () => {
    const messageElement = document.getElementById("message");
    try {
        // Clear the token and login state
        await chrome.storage.local.remove(['token', 'isLoggedIn']);
        console.log("User logged out successfully.");
        // Update UI
        messageElement.textContent = "Logged out successfully!";
        showLoggedOutState();
    } catch (error) {
        console.error("Logout error:", error);
        messageElement.textContent = "An error occurred during logout.";
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
    // Note: Button creation is now handled by createImportButtonOnce and createCopyButtonOnce
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
function createImportButtonOnce() {
    if (!document.getElementById("importButton")) {
        console.log("Creating Import button");
        const importButton = document.createElement("button");
        importButton.id = "importButton";
        importButton.textContent = "Import";
        document.body.appendChild(importButton);

        importButton.addEventListener("click", () => {
            console.log("Import button clicked"); // Add this log
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
    } else {
        console.log("Import button already exists");
    }
}

// Listener for scraped data from content.js (for import)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendProfileDataForImport") {
        const { name, headline, company: company, location, url } = request.profileData; // Consistent key

        const leads = [
            {
                name: name || "No Name Provided",
                headline: headline || "No Headline Provided",
                company: company || "No Company Provided",
                location: location || "No Location Provided",
                url: url || "No URL Provided",
            },
        ];

        chrome.storage.local.get(["token"], (result) => {
            const token = result.token;
            const messageElement = document.getElementById("message");
            if (token) {
                importLeads(token, leads, messageElement); // Pass message element
            } else {
                messageElement.textContent =
                    "Please log in to continue importing.";
            }
        });
    }
});

async function importLeads(token, leads, messageElement) { // Receive message element
    const existingLeads = await fetchExistingLeads(token, messageElement); // Pass message element

    if (!existingLeads) {
        messageElement.textContent =
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
        messageElement.textContent = "No new leads to import.";
        return;
    }

    const formData = new FormData();
    newLeads.forEach((lead, index) => {
        formData.append(`leads[${index}][name]`, lead.name);
        formData.append(`leads[${index}][cjobtitle]`, lead.headline);
        formData.append(`leads[${index}][ccompany]`, lead.company);
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
            messageElement.textContent =
                "Leads imported successfully!";
        })
        .catch((error) => {
            console.error("Error during lead import:", error);
            messageElement.textContent =
                "An error occurred while importing leads.";
        });
}

async function fetchExistingLeads(token, messageElement) { // Receive message element
    try {
        const response = await fetch("http://127.0.0.1:8000/api/leads", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to fetch existing leads:", errorData);
            messageElement.textContent = `Failed to fetch existing leads: ${errorData.message || response.statusText}`;
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching existing leads:", error);
        messageElement.textContent = "An error occurred while fetching existing leads.";
        return null;
    }
}


// Create a Dynamic Copy Button
function createCopyButtonOnce() {
    if (!document.getElementById("copyButton")) {
        const copyButton = document.createElement("button");
        copyButton.id = "copyButton";
        copyButton.textContent = "Copy Profile Data";
        document.body.appendChild(copyButton);

        const messageElement = document.getElementById("message");

        copyButton.addEventListener("click", () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0].id;

                chrome.scripting.executeScript(
                    {
                        target: { tabId: tabId },
                        files: ["content.js"],
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error injecting script:", chrome.runtime.lastError.message);
                            messageElement.textContent = "Error injecting script to scrape data.";
                            return;
                        }

                        chrome.tabs.sendMessage(tabId, { action: "scrapeLinkedInProfile" }, (response) => {
                            if (!response || !response.success) {
                                messageElement.textContent = "Failed to scrape profile data!";
                                return;
                            }

                            const profileData = response.profileData;
                            const tsvData = `${profileData.name || ''}\t${profileData.headline || ''}\t${profileData.company || ''}\t${profileData.location || ''}\t\t\t\t${profileData.url || ''}\t${profileData.copyTime || ''}`;

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
                                        document.execCommand('copy');
                                        chrome.runtime.sendMessage({ action: 'copySuccess' });
                                    } catch (err) {
                                        console.error('Error copying to clipboard:', err);
                                    } finally {
                                        document.body.removeChild(tempInput);
                                    }
                                },
                                args: [tsvData],
                            }).catch((err) => {
                                console.error('Failed to execute script for copying:', err);
                                messageElement.textContent = 'Failed to copy data!';
                            });
                        });
                    }
                );
            });
        });
    }
}

// Listener for copy success message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'copySuccess') {
        const messageElement = document.getElementById("message");
        messageElement.textContent = 'Profile data copied to clipboard!';
        setTimeout(() => {
            if (messageElement.textContent === 'Profile data copied to clipboard!') {
                messageElement.textContent = "You are logged in!";
            }
        }, 2000);
    }
});