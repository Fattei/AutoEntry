const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Puppeteer processor with conditional logic, pagination, and error handling.
 * @param {object} job - The job object from BullMQ.
 * @param {object} job.data - The data associated with the job.
 * @param {string} job.data.url - The URL to scrape.
 * @param {object} [job.data.puppeteerOptions] - Optional Puppeteer launch options.
 * @param {Array<object>} [job.data.actions] - Array of actions to perform on the page.
 * @param {object} [job.data.pagination] - Pagination configuration.
 * @param {string} [job.data.pagination.nextButtonSelector] - Selector for next page button.
 * @param {number} [job.data.pagination.maxPages] - Maximum pages to scrape (default: 10).
 * @param {number} [job.data.pagination.delayBetweenPages] - Delay between page navigations (ms).
 * @param {object} [job.data.waitConditions] - Global wait conditions.
 * @param {number} [job.data.timeout] - Global timeout for operations (default: 30000ms).
 * @param {boolean} [job.data.saveScreenshots] - Whether to save screenshots on errors.
 * @param {string} [job.data.screenshotDir] - Directory to save screenshots.
 * @returns {Promise<object>} - The scraped data with pagination results.
 */
async function puppeteerProcessor({ data }) {
  const { 
    url, 
    puppeteerOptions = {}, 
    actions = [], 
    pagination = {},
    waitConditions = {},
    timeout = 30000,
    saveScreenshots = false,
    screenshotDir = './screenshots'
  } = data;

  // Enhanced validation
  if (!url) throw new Error('URL is required for puppeteerProcessor.');
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new Error(`Invalid URL format: ${url}. Must start with http:// or https://.`);
  }
  if (!Array.isArray(actions)) throw new Error('Actions must be an array.');
  
  // Validate pagination config
  if (pagination.maxPages && (typeof pagination.maxPages !== 'number' || pagination.maxPages < 1)) {
    throw new Error('pagination.maxPages must be a positive number.');
  }

  let browser = null;
  const startTime = Date.now();
  const allResults = [];
  let currentPage = 1;
  
  console.log(`🚀 Starting enhanced Puppeteer job for URL: ${url}`);
  console.log(`📋 Job config: ${actions.length} actions, pagination: ${!!pagination.nextButtonSelector}, timeout: ${timeout}ms`);

  try {
    // Browser launch options
    const defaultOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };

    browser = await puppeteer.launch({
      ...defaultOptions,
      ...puppeteerOptions,
    });

    const page = await browser.newPage();
    
    // Page setup
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set default timeouts
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    // Enhanced error handling for page events
    page.on('error', err => console.error('❌ Page error:', err.message));
    page.on('pageerror', err => console.error('❌ Page script error:', err.message));

    // Create screenshot directory if needed
    if (saveScreenshots) {
      await fs.mkdir(screenshotDir, { recursive: true }).catch(() => {});
    }

    // Main pagination loop
    do {
      console.log(`📄 Processing page ${currentPage}${pagination.maxPages ? ` of max ${pagination.maxPages}` : ''}`);
      
      try {
        // Navigate to URL (only on first page)
        if (currentPage === 1) {
          console.log(`Navigating to ${url}...`);
          await page.goto(url, { 
            waitUntil: 'networkidle2', 
            timeout: timeout 
          });

          // Wait for custom conditions if specified
          if (waitConditions.selector) {
            await page.waitForSelector(waitConditions.selector, { timeout });
          }
          if (waitConditions.delay) {
            await page.waitForTimeout(waitConditions.delay);
          }
        }

        // Process current page
        const pageData = await processPage(page, actions, currentPage, saveScreenshots, screenshotDir);
        allResults.push({
          page: currentPage,
          url: await page.url(),
          timestamp: new Date().toISOString(),
          ...pageData
        });

        // Check for next page
        if (pagination.nextButtonSelector && currentPage < (pagination.maxPages || Infinity)) {
          const hasNextPage = await checkAndNavigateToNextPage(
            page, 
            pagination.nextButtonSelector, 
            pagination.delayBetweenPages || 2000
          );
          
          if (!hasNextPage) {
            console.log('🏁 No more pages found, ending pagination');
            break;
          }
          currentPage++;
        } else {
          break;
        }

      } catch (pageError) {
        console.error(`❌ Error processing page ${currentPage}:`, pageError.message);
        
        if (saveScreenshots) {
          const errorScreenshot = path.join(screenshotDir, `error-page-${currentPage}-${Date.now()}.png`);
          await page.screenshot({ path: errorScreenshot, fullPage: true }).catch(() => {});
          console.log(`📸 Error screenshot saved: ${errorScreenshot}`);
        }

        // Add error info to results
        allResults.push({
          page: currentPage,
          error: pageError.message,
          timestamp: new Date().toISOString()
        });

        // Continue to next page or break based on error severity
        if (pagination.nextButtonSelector && pageError.message.includes('timeout')) {
          break; // Stop pagination on timeout errors
        }
        currentPage++;
      }

    } while (pagination.nextButtonSelector && currentPage <= (pagination.maxPages || 10));

    const totalTime = Date.now() - startTime;
    console.log(`✅ Job completed: ${allResults.length} pages processed in ${totalTime}ms`);

    return {
      success: true,
      totalPages: allResults.length,
      processingTimeMs: totalTime,
      results: allResults,
      summary: generateSummary(allResults)
    };

  } catch (error) {
    console.error(`💥 Fatal error in puppeteerProcessor for ${url}:`, error);
    
    if (saveScreenshots && browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const errorScreenshot = path.join(screenshotDir, `fatal-error-${Date.now()}.png`);
          await pages[0].screenshot({ path: errorScreenshot, fullPage: true });
          console.log(`📸 Fatal error screenshot saved: ${errorScreenshot}`);
        }
      } catch (screenshotError) {
        console.error('Failed to save error screenshot:', screenshotError.message);
      }
    }

    throw error;
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Process a single page with the given actions
 */
async function processPage(page, actions, pageNumber, saveScreenshots, screenshotDir) {
  const scrapedData = {};
  
  try {
    scrapedData.pageTitle = await page.title();
    scrapedData.currentUrl = await page.url();
    
    for (const [index, action] of actions.entries()) {
      if (!action || typeof action.type !== 'string') {
        console.warn(`⚠️ Skipping invalid action ${index}:`, action);
        continue;
      }

      console.log(`🔧 [Page ${pageNumber}] Executing action ${index + 1}/${actions.length}: ${action.type}${action.selector ? ` on ${action.selector}` : ''}`);

      try {
        const actionResult = await executeAction(page, action);
        if (actionResult && action.name) {
          scrapedData[action.name] = actionResult;
        }

        // Post-action delay
        if (action.delayAfter) {
          await page.waitForTimeout(Number(action.delayAfter));
        }

      } catch (actionError) {
        console.warn(`❌ Action ${action.type} failed:`, actionError.message);
        scrapedData.errors = scrapedData.errors || [];
        scrapedData.errors.push({
          actionIndex: index,
          action: action.type,
          selector: action.selector,
          message: actionError.message
        });

        // Save screenshot on action error if enabled
        if (saveScreenshots) {
          const errorScreenshot = path.join(screenshotDir, `action-error-p${pageNumber}-a${index}-${Date.now()}.png`);
          await page.screenshot({ path: errorScreenshot, fullPage: true }).catch(() => {});
        }

        // Continue with next action unless it's marked as critical
        if (action.critical) {
          throw actionError;
        }
      }
    }

    return scrapedData;
  } catch (error) {
    console.error(`Error processing page ${pageNumber}:`, error);
    throw error;
  }
}

/**
 * Execute a single action with enhanced conditional logic
 */
async function executeAction(page, action) {
  const { type, selector, condition = {} } = action;

  // Check conditions before executing action
  if (condition.ifExists && selector) {
    const elementExists = await page.$(selector) !== null;
    if (!elementExists) {
      console.log(`⏭️ Skipping action ${type}: element ${selector} does not exist`);
      return null;
    }
  }

  if (condition.ifNotExists && selector) {
    const elementExists = await page.$(selector) !== null;
    if (elementExists) {
      console.log(`⏭️ Skipping action ${type}: element ${selector} exists`);
      return null;
    }
  }

  if (condition.ifTextContains && selector) {
    const element = await page.$(selector);
    if (element) {
      const text = await element.evaluate(el => el.textContent);
      if (!text || !text.includes(condition.ifTextContains)) {
        console.log(`⏭️ Skipping action ${type}: text condition not met`);
        return null;
      }
    }
  }

  // Execute the action
  switch (type) {
    case 'click':
      if (!selector) throw new Error('Selector required for click action');
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      break;

    case 'type':
      if (!selector || typeof action.text !== 'string') {
        throw new Error('Selector and text required for type action');
      }
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.focus(selector);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type(selector, action.text);
      break;

    case 'extract':
      if (!selector) throw new Error('Selector required for extract action');
      
      // Wait for selector with optional condition
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
      } catch (timeoutError) {
        if (condition.optional) {
          console.log(`⏭️ Optional extraction skipped: ${selector} not found`);
          return [];
        }
        throw timeoutError;
      }

      const extractedItems = await page.$$eval(
        selector,
        (els, attr, options = {}) => {
          return els.map(el => {
            let value;
            if (attr) {
              value = el.getAttribute(attr);
            } else {
              value = options.innerHTML ? el.innerHTML : el.textContent?.trim();
            }
            
            // Additional processing
            if (options.parseNumber && value) {
              const num = parseFloat(value.replace(/[^\d.-]/g, ''));
              return isNaN(num) ? value : num;
            }
            
            return value || null;
          }).filter(item => item !== null);
        },
        action.attribute,
        {
          innerHTML: action.innerHTML || false,
          parseNumber: action.parseNumber || false
        }
      );

      console.log(`📄 Extracted ${extractedItems.length} items for "${action.name || selector}"`);
      return extractedItems;

    case 'waitForSelector':
      if (!selector) throw new Error('Selector required for waitForSelector action');
      await page.waitForSelector(selector, { 
        timeout: action.timeout || 10000,
        visible: action.visible !== false 
      });
      break;

    case 'delay':
      const delayMs = Number(action.ms || 1000);
      console.log(`⏳ Waiting ${delayMs}ms`);
      await page.waitForTimeout(delayMs);
      break;

    case 'screenshot':
      const screenshotPath = action.path || `screenshot-${Date.now()}.png`;
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: action.fullPage !== false,
        quality: action.quality || undefined
      });
      console.log(`📸 Screenshot saved to ${screenshotPath}`);
      return screenshotPath;

    case 'scroll':
      if (action.toBottom) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } else if (action.toSelector && selector) {
        await page.evaluate((sel) => {
          document.querySelector(sel)?.scrollIntoView();
        }, selector);
      } else {
        await page.evaluate((x, y) => window.scrollTo(x, y), action.x || 0, action.y || 0);
      }
      break;

    case 'evaluate':
      if (!action.script) throw new Error('Script required for evaluate action');
      return await page.evaluate(new Function(action.script));

    default:
      throw new Error(`Unknown action type: ${type}`);
  }

  return null;
}

/**
 * Check for next page and navigate if available
 */
async function checkAndNavigateToNextPage(page, nextButtonSelector, delay = 2000) {
  try {
    // Check if next button exists and is enabled
    const nextButton = await page.$(nextButtonSelector);
    if (!nextButton) {
      console.log('📄 Next page button not found');
      return false;
    }

    // Check if button is disabled
    const isDisabled = await nextButton.evaluate(el => 
      el.disabled || 
      el.classList.contains('disabled') || 
      el.getAttribute('aria-disabled') === 'true' ||
      el.style.display === 'none' ||
      el.style.visibility === 'hidden'
    );

    if (isDisabled) {
      console.log('📄 Next page button is disabled');
      return false;
    }

    // Get current URL before clicking
    const currentUrl = await page.url();
    
    // Click next button
    await nextButton.click();
    console.log('🔄 Clicked next page button');

    // Wait for navigation or content change
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        page.waitForFunction(() => window.location.href !== currentUrl, { timeout: 10000 }),
        page.waitForTimeout(delay) // Fallback for AJAX-based pagination
      ]);
    } catch (waitError) {
      console.log('⚠️ Navigation wait completed with timeout, continuing...');
    }

    // Additional delay for content loading
    await page.waitForTimeout(delay);
    
    console.log(`📄 Successfully navigated to next page: ${await page.url()}`);
    return true;

  } catch (error) {
    console.error('❌ Error navigating to next page:', error.message);
    return false;
  }
}

/**
 * Generate summary of scraping results
 */
function generateSummary(results) {
  const summary = {
    totalPages: results.length,
    successfulPages: results.filter(r => !r.error).length,
    errorPages: results.filter(r => r.error).length,
    totalErrors: results.reduce((sum, r) => sum + (r.errors?.length || 0), 0)
  };

  // Extract common data types
  const allData = results.filter(r => !r.error);
  if (allData.length > 0) {
    const sampleData = allData[0];
    summary.dataTypes = Object.keys(sampleData).filter(key => 
      !['page', 'url', 'timestamp', 'pageTitle', 'currentUrl', 'errors'].includes(key)
    );
    
    // Count total items extracted
    summary.totalItemsExtracted = allData.reduce((sum, pageData) => {
      return sum + summary.dataTypes.reduce((pageSum, key) => {
        const value = pageData[key];
        return pageSum + (Array.isArray(value) ? value.length : 0);
      }, 0);
    }, 0);
  }

  return summary;
}

module.exports = puppeteerProcessor;
