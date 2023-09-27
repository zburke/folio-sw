let tokenExpiration = null;
let okapiUrl = null;

// validate an AT
const isValidAT = () => {
  return !!(tokenExpiration?.atExpires > Date.now());
}

// validate an RT
const isValidRT = () => {
  return !!(tokenExpiration?.rtExpires > Date.now());
}


/**
 * rtr
 * exchange an RT for a new one
 * @param {} e
 * @returns
 * @throws if RTR fails
 */
const rtr = (e) => {
  console.log('RTR')
  return fetch(`${okapiUrl}/authn/refresh`, {
    method: 'POST',
    credentials: 'include',
    mode: 'cors',
  })
    .then(res => {
      if (res.ok) {
        return res.json();
      }
      throw 'RTR response failure';
    })
    .then(json => {
      tokenExpiration = {
        atExpires: new Date(json.accessTokenExpiration).getTime(),
        rtExpires: new Date(json.refreshTokenExpiration).getTime(),
      };
      console.log('REFRESH BODY', { tokenExpiration })
      messageToClient(e, { type: 'TOKEN_EXPIRATION', tokenExpiration })
      return;
    });
};
//     sw.postMessage({ type: 'TOKEN_EXPIRATION', ...{ atExpires, rtExpires }});


const messageToClient = async (e, message) => {
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
  console.log(`message to ${e.clientId}`, message);
  client.postMessage(message);
};

const isLoginRequest = (request) => {
  return request.url.includes('login-with-expiry');
};

const isRefreshRequest = (request) => {
  return request.url.includes('authn/refresh');
};

/**
 * isPermissibleRequest
 * Some requests are always permissible, e.g. auth-n and token-rotation.
 * Others are only permissible if the Access Token is still valid.
 * @param {} req
 * @returns
 */
const isPermissibleRequest = (req) => {
  return isLoginRequest(req) || isRefreshRequest(req) || isValidAT();
}

const passThrough = async (e) => {
  const req = e.request.clone();

  console.log('passThrough', req.url)

  if (isPermissibleRequest(req)) {
    return fetch(e.request, { credentials: 'include' })
      .catch(e => {
        console.error(e);
        return Promise.reject(e);
      });
  }

  if (isValidRT()) {
    console.log('passthrough: valid RT')
    try {
      let res = await rtr(e);
      return fetch(e.request, { credentials: 'include' });
    } catch (e) {
      console.log('passThrough fail', e)
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
  console.info('=> install', install)
  return self.skipWaiting()
});

/**
 * activate
 * on activate, force this SW to control all in-scope clients,
 * even those that loaded before this SW was registered.
 */
self.addEventListener('activate', async function (event) {
  console.info('=> activate', event)
  event.waitUntil(clients.claim());
})

self.addEventListener('message', async function (event) {
  console.info('=> message', event.data)
  if (event.data.type === 'OKAPI_URL') {
    okapiUrl = event.data.value;
  }

  if (event.data.type === 'TOKEN_EXPIRATION') {
    tokenExpiration = { ...event.data.tokenExpiration }
  }
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
  console.log('=> fetch') // , event.request.url)

  event.respondWith(passThrough(event));
});

