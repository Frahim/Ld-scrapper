chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeLinkedInProfile") {
      try {
        // --- 1. Scraping with Improved Selector Logic ---
        const nameElement = document.querySelector('h1.v-align-middle.break-words');
        const headlineElement = document.querySelector('.text-body-medium.break-words');
  
        let company = '';
let location = '';

const experienceSection = document.querySelector('#experience');
const firstJob = experienceSection?.querySelector('ul > li');

if (firstJob) {
  const companyElement = firstJob.querySelector('span[aria-hidden="true"]');
  const locationElement = firstJob.querySelector('.t-14.t-normal.t-black--light');

  company = companyElement ? companyElement.textContent.trim() : '';
  location = locationElement ? locationElement.textContent.trim() : '';
} else {
  // Fallback
  const companyElementFallback = document.querySelector('div[style*="-webkit-line-clamp:2"]');
  const locationElementFallback = document.querySelector('.text-body-small.inline.t-black--light.break-words');

  company = companyElementFallback ? companyElementFallback.textContent.trim() : '';
  location = locationElementFallback ? locationElementFallback.textContent.trim() : '';
}

  
        const url = window.location.href;
        const copyTime = new Date().toLocaleString();
  
        const profileData = {
            name: nameElement ? nameElement.textContent.trim() : '',
            headline: headlineElement ? headlineElement.textContent.trim() : '',
            company: company, // rename this key here
            location: location,
            url: url,
            copyTime: copyTime,
          };
  
        const hasData = Object.values(profileData).some(value => value !== '');
        if (!hasData) {
          console.error('content.js: No core profile data found.');
          sendResponse({ success: false, error: 'No profile data extracted.' });
          return;
        }
  
        console.log("content.js: Scraped Data:", profileData);
  
        // --- 2. Respond based on context ---
        switch (request.context) {
          case 'copy':
            chrome.runtime.sendMessage({ action: "sendProfileDataForCopy", profileData });
            break;
          case 'import':
            chrome.runtime.sendMessage({ action: "sendProfileDataForImport", profileData });
            break;
          default:
            console.warn("content.js: No context provided in request.");
            // Still send the data back in case the caller wants to handle it
            sendResponse({ success: true, profileData });
            break;
        }
  
      } catch (error) {
        console.error("content.js: Error during scraping:", error);
        sendResponse({ success: false, error: error.message });
      }
    }
  });
  