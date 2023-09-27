// validate an AT
const isValidAT = (e) => !e.request.url.includes('cookie') || (e.request.url.includes('cookie') && e.request.url.includes('vat'));

// validate an RT
const isValidRT = (e) => !e.request.url.includes('cookie') || (e.request.url.includes('cookie') && e.request.url.includes('vrt'));

// exchange an RT for a new one
const rtr = () => {
  return Promise.resolve();
};

const messageToClient = async (e) => {
  // Exit early if we don't have access to the client.
  // Eg, if it's cross-origin.
  if (!e.clientId) {
    console.log('PASSTHROUGH: no clientId')
    return;
  }

  // Get the client.
  const client = await clients.get(e.clientId);
  // Exit early if we don't get the client.
  // Eg, if it closed.
  if (!client) {
    console.log('PASSTHROUGH: no client')
    return;
  }

  // Send a message to the client.
  console.log('message to', e.clientId)
  client.postMessage(['passthrough', e.request.url]);
};

const passThrough = async (e) => {
  e.waitUntil(messageToClient(e));

  console.log('passThrough', e.request.url)
  if (isValidAT(e)) {
    console.log('valid AT')
    return fetch(e.request, { credentials: 'include' });
  }

  if (isValidRT(e)) {
    console.log('valid RT')
    try {
      let res = await Promise.resolve('new RT');
      console.log('RTR renew success', res)
      return fetch(e.request, { credentials: 'include' });
    } catch (e) {
      console.log('RTR renew failure')
    }
  }

  console.log('token failure')
  return Promise.reject('KABOOM');
};

/**
 * install
 * on install, force this SW to be the active SW
 */
self.addEventListener('install', (event) => {
  console.info('=> install')
  return self.skipWaiting()
});

/**
 * activate
 * on activate, force this SW to control all in-scope clients
 */
self.addEventListener('activate', async function (event) {
  console.info('=> activate')
  event.waitUntil(clients.claim());
})

self.addEventListener('message', async function (event) {
  console.info('=> message', event.data)
})

/**
 * fetch
 * Inspect AT/RT tokens before passing through all fetch requests and
 * returning the resulting promise:
 * * If the AT is valid, return pass through.
 * * If the AT is not valid, perform token rotation if the RT is valid.
 *   * If rotation succceeds, return pass through.
 * * Return Promise.reject()
 */
self.addEventListener('fetch', async function (event) {
  console.log('=> fetch', event.request.url)

  event.respondWith(passThrough(event));

  /*
  event.respondWith(new Promise(async (resolve, reject) => {
    return passThrough(event)
      .then(res => {
        console.log('pass/resolve')
        return resolve(res);
      })
      // even if we catch, we still see an unhandled promise in Chrome :(
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1475744
      .catch(res => {
        console.log('pass/reject')
        return reject(res);
      })
  }));
  */
});

