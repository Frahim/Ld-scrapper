document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch('http://e1leads.agrilfoods.com/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            // Store the token in local storage
            chrome.storage.local.set({ authToken: data.token }, function() {
                alert("Login successful!");
                window.close(); // Close the login window
            });
        } else {
            document.getElementById("errorMessage").style.display = "block";
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById("errorMessage").style.display = "block";
    });
});
