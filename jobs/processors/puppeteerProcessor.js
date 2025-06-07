const puppeteer = require('puppeteer');

/**
 * Processes a web scraping job using Puppeteer.
 * @param {object} job - The job object from BullMQ.
 * @param {object} job.data - The data associated with the job.
 * @param {string} job.data.url - The URL to scrape.
 * @param {object} [job.data.puppeteerOptions] - Optional Puppeteer launch options.
 * @param {Array<object>} [job.data.actions] - Optional array of actions to perform on the page.
 * @returns {Promise<object>} - The scraped data.
 */
async function puppeteerProcessor({ data }) {
  const { url, puppeteerOptions = {}, actions = [] } = data;

  if (!url) throw new Error('URL is required for puppeteerProcessor.');
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new Error(`Invalid URL format: ${url}. Must start with http:// or https://.`);
  }
  if (!Array.isArray(actions)) throw new Error('Actions must be an array.');

  let browser = null;
  console.log(`🚀 Starting Puppeteer job for URL: ${url}`);

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...puppeteerOptions,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const scrapedData = {};
    scrapedData.pageTitle = await page.title();

    for (const action of actions) {
      if (!action || typeof action.type !== 'string') {
        console.warn('Skipping invalid action:', action);
        continue;
      }

      console.log(`🔧 Executing action: ${action.type}${action.selector ? ` on ${action.selector}` : ''}`);

      try {
        switch (action.type) {
          case 'click':
            await page.waitForSelector(action.selector, { timeout: 10000 });
            await page.click(action.selector);
            break;

          case 'type':
            if (typeof action.text !== 'string') {
              console.warn(`Skipping 'type' action due to invalid text:`, action);
              break;
            }
            await page.waitForSelector(action.selector, { timeout: 10000 });
            await page.type(action.selector, action.text);
            break;

          case 'extract':
            await page.waitForSelector(action.selector, { timeout: 10000 });
            const extractedItems = await page.$$eval(
              action.selector,
              (els, attr) =>
                els.map(el =>
                  attr ? el.getAttribute(attr) : el.textContent?.trim() ?? null
                ),
              action.attribute
            );
            scrapedData[action.name || action.selector] = extractedItems;
            console.log(`📄 Extracted ${extractedItems.length} items for "${action.name || action.selector}"`);
            break;

          case 'delay':
            const delayMs = Number(action.ms || 1000);
            console.log(`⏳ Waiting ${delayMs}ms`);
            await page.waitForTimeout(delayMs);
            break;

          case 'screenshot':
            const path = action.path || `screenshot-${Date.now()}.png`;
            await page.screenshot({ path, fullPage: true });
            scrapedData.screenshotPath = path;
            console.log(`📸 Screenshot saved to ${path}`);
            break;

          default:
            console.warn(`⚠️ Unknown action type: ${action.type}`);
        }

        if (action.delayAfter) {
          await page.waitForTimeout(Number(action.delayAfter));
        }
      } catch (err) {
        console.warn(`❌ Action failed: ${action.type} on ${action.selector || ''}: ${err.message}`);
        scrapedData.errors = scrapedData.errors || [];
        scrapedData.errors.push({ action, message: err.message });
      }
    }

    return { scrapedUrl: url, ...scrapedData };
  } catch (error) {
    console.error(`Error in puppeteerProcessor for ${url}:`, error);
    throw error;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}

module.exports = puppeteerProcessor;
