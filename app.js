/** setTimeout timer */
let idleTimer = null;

/** service worker's registration */
let registration = null;

/** timestamp of last activity in milliseonds */
let lastActive = -1;

/** are we authenticated? */
let authenticated = false;

/** AT expiration timestamp in milliseconds */
let atExpires = -1;

/** RT expiration timestamp in milliseconds */
let rtExpires = -1;

/** session length in milliseconds */
// dummy value
const SESSION_LENGTH = 10 * 1000;

/**
 * registerSW
 * * register SW
 * * send SW the Okapi URL.
 * * listen for messages sent from SW
 * Note that although normally a page must be reloaded after a service worker
 * has been installed in order for the page to be controlled, this one
 * immediately claims control. Otherwise, no RTR would occur until after a
 * reload.
 */
const registerSW = async () => {
  if ('serviceWorker' in navigator) {
    try {
      let sw = null;

      //
      // register
      //
      registration = await navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(registration => {
          return registration.update();
        });
      if (registration.installing) {
        sw = registration.installing;
        console.log('=> Service worker installing');
      } else if (registration.waiting) {
        sw = registration.waiting;
        console.log('=> Service worker installed');
      } else if (registration.active) {
        sw = registration.active;
        console.log('=> Service worker active');
      }

      //
      // send SW an OKAPI_URL message
      //
      if (sw) {
        sw.postMessage({ type: 'OKAPI_URL', value: document.getElementById('okapi').value });
      } else {
        console.error('SW NOT AVAILBLE')
      }
    } catch (error) {
      console.error(`=> Registration failed with ${error}`);
    }

    //
    // listen for messages
    //
    navigator.serviceWorker.addEventListener("message", (e) => {
      console.info('<= reading', e.data)
      if (e.data.type === 'TOKEN_EXPIRATION') {
        atExpires = e.data.tokenExpiration.atExpires;
        rtExpires = e.data.tokenExpiration.rtExpires;

        console.log(`atExpires ${atExpires}`)
        console.log(`rtExpires ${rtExpires}`)
      }
    });

    // talk to me, goose
    if (navigator.serviceWorker.controller) {
      console.log("This page is currently controlled by:", navigator.serviceWorker.controller);
    }
    navigator.serviceWorker.oncontrollerchange = () => {
      console.log("This page is now controlled by", navigator.serviceWorker.controller);
    };
  }
};

const unregisterSW = async () => {
  console.log('unregister')
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

/**
 * startIdleTimer
 * Start a timer that should last the length of the session,
 * calling the timeout-handler if/when it expires. This function
 * should be called by event-listener that tracks activity: each
 * time the event-listener pings the existing timer will be cancelled
 * and a new one started to keep the session alive.
 */
const startIdleTimer = () => {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }

  document.querySelector('#expires').textContent = new Date(Date.now() + SESSION_LENGTH);

  // @@ in reality,
  // @@ idleTimer = setTimeout(logout, rtExpires - Date.now());
  idleTimer = setTimeout(() => {
    console.log(`logging out; no activity since ${new Date(lastActive).toISOString()}`)
    logout();
  }, SESSION_LENGTH);
}

// look, a fetch! to prove that we can do RTR
const getUsers = () => {
  const offset = Math.floor(Math.random() * 350);
  return fetch(`${ document.getElementById('okapi').value}/users?limit=1&offset=${offset}`, {
    method: 'GET',
    headers: {
      'x-okapi-tenant': document.getElementById('tenant').value,
      'content-type': 'application/json',
    },
    'credentials': 'include',
    'mode': 'cors',
    })
    .then(res => {
      if (res.ok) {
        return res.json();
      } else {
        res.json().then(json => { throw json;  })
      }
    });
};

/**
 * login
 * send an authentication request
 * then pluck the JSON from the response
 * then store tokenExpiration info, send it to SW, start the idle timer
 */
const login = () => {
  console.log('login')
  fetch(`${ document.getElementById('okapi').value}/bl-users/login-with-expiry`, {
    method: 'POST',
    headers: {
      'x-okapi-tenant': document.getElementById('tenant').value,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      username: document.getElementById('username').value,
      password: document.getElementById('password').value,
    }),
  })
    .then((res) => {
      if (res.ok) {
        return res.json();
      } else {
        console.error('authn failure');
        res.json().then(json => { throw json;  })
      }
    })
    .then(json => {
      console.log('logged in', json)
      authenticated = true;
      atExpires = new Date(json.tokenExpiration.accessTokenExpiration).getTime();
      rtExpires = new Date(json.tokenExpiration.refreshTokenExpiration).getTime();

      console.log(`atExpires ${atExpires}`)
      console.log(`rtExpires ${rtExpires}`)

      dispatchTokenExpiration();
      startIdleTimer()

      document.getElementById('authenticated').hidden = false;
      document.getElementById('public').hidden = true;
    })
    .catch(e => {
      console.error('Boom', e)
      logout();
    });
};

/**
 * logout
 * clear the idle timer
 */
const logout = () => {
  console.log('logout')
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  authenticated = false;
  atExpires = -1;
  rtExpires = -1;
  dispatchTokenExpiration();

  let p = Promise.resolve()
    .then(() => {
      console.log('logged out')
      document.getElementById('authenticated').hidden = true;
      document.getElementById('public').hidden = false;
    })
    .catch();
};

/**
 * handleShowUsers
 * retrieve users via API request and display the result
 */
const handleShowUsers = () => {
  getUsers()
    .then(json => {
      document.querySelector('#content').textContent = JSON.stringify(json, null, 2);
    });
};

/**
 * dispatchTokenExpiration
 * send SW a TOKEN_EXPIRATION message
 */
const dispatchTokenExpiration = () => {
  const sw = registration.active;
  if (sw) {
    const message = { type: 'TOKEN_EXPIRATION', tokenExpiration: { atExpires, rtExpires } };
    console.log('<= sending', message); console.trace();
    sw.postMessage(message);
  } else {
    console.warn('could not dispatch message; no active registration')
  }
};

/**
 * invalidateAT
 * expire the AT and notify the SW
 */
const invalidateAT = () => {
  atExpires = -1;
  dispatchTokenExpiration();
}

/**
 * invalidateRT
 * expire the AT and the RT and notify the SW
 */
const invalidateRT = () => {
  atExpires = -1;
  rtExpires = -1;

  console.log(`atExpires ${atExpires}`)
  console.log(`rtExpires ${rtExpires}`)


  dispatchTokenExpiration();
}



/**
 * eventListener: click activity
 * * given any click activity, restart the idle timer
 * * record the last-active timestamp for logging purposes only
 */
document.addEventListener('click', () => {
  if (authenticated) {
    lastActive = Date.now();
    startIdleTimer();
  }
});

// eventListener: click those buttons
document.getElementById('vat').addEventListener('click', () => invalidateAT());
document.getElementById('vrt').addEventListener('click', () => invalidateRT());
document.getElementById('users').addEventListener('click', () => handleShowUsers());
document.getElementById('login').addEventListener('click', () => login());
document.getElementById('logout').addEventListener('click', () => logout());

// await unregisterSW();
await registerSW();
