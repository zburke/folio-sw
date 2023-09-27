const registerSW = async () => {
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('sw.js', { scope: './', 'monkey': 'bagel' })
        .then(registration => {
          return registration.update();
        });

      if (registration.installing) {
        console.log('=> Service worker installing');
      } else if (registration.waiting) {
        console.log('=> Service worker installed');
      } else if (registration.active) {
        console.log('=> Service worker active');
        const sw = registration.active;
        if (sw) {
          sw.postMessage({ type: 'OKAPI_URL', value: document.getElementById('okapi').value });
        }
      }

    } catch (error) {
      console.error(`=> Registration failed with ${error}`);
    }

    navigator.serviceWorker.addEventListener("message", (e) => {
      console.info('<= message', e.data)
      if (e.data.type === 'TOKEN_EXPIRATION') {
        atExpires = new Date(e.data.tokenExpiration.accessTokenExpiration).getTime();
        rtExpires = new Date(e.data.tokenExpiration.refreshTokenExpiration).getTime();
      }
    });

    if (navigator.serviceWorker.controller) {
      console.log("This page is currently controlled by:", navigator.serviceWorker.controller,);
    }

    navigator.serviceWorker.oncontrollerchange = () => {
      console.log( "This page is now controlled by", navigator.serviceWorker.controller);
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


const startIdleTimer = () => {
  if (timer) {
    clearTimeout(timer);
  }
  console.log('resetting lastActive', atExpires);
  lastActive = Date.now();
  // timer = setTimeout(handleIdleTimeout, rtExpires - lastActive);
  timer = setTimeout(handleIdleTimeout, SESSION_LENGTH);
}

const handleIdleTimeout = () => {
  if (!isActive()) {
    console.log(`no activity since ${new Date(lastActive).toISOString()}`)
    logout();
  }
};

const getUsers = () => {
  const offset = Math.floor(Math.random() * 350);
  return fetch(`${ document.getElementById('okapi').value}/users?limit=1&offset=${offset}`, {
    method: 'GET',
    headers: {
      'x-okapi-tenant': 'diku',
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
      talk();

      // startAccessTokenTimer();
      startIdleTimer()

      document.getElementById('authenticated').hidden = false;
      document.getElementById('public').hidden = true;
    })
    .catch(e => {
      console.error('Boom', e)
      logout();
    });
};

const logout = () => {
  console.log('logout')
  if (timer) {
    clearTimeout(timer)
  }
  authenticated = false;
  atExpires = Date.now() - 10000;
  rtExpires = Date.now() - 10000;

  let p = Promise.resolve()
    .then(() => {
      console.log('logged out')
      document.getElementById('authenticated').hidden = true;
      document.getElementById('public').hidden = false;
    })
    .catch();
};

const showUsers = () => {
  getUsers()
    .then(json => {
      document.querySelector('#content').textContent = JSON.stringify(json, null, 2);
    });
};

const talk = () => {
  const sw = registration.active;
  if (sw) {
    sw.postMessage({ type: 'TOKEN_EXPIRATION', ...{ atExpires, rtExpires }});
  } else {
    console.warn('message failure; could not talk; no active registration')
  }
};

const invalidateAT = () => {
  atExpires = 1;
  talk();
}

const invalidateRT = () => {
  atExpires = 1;
  rtExpires = 1;
  talk();
}

/**
 * isActive
 * return true if SESSION_LENGTH milliseconds have not passed since the
 * lastActive timestamp.
 * @returns boolean
 */
const isActive = () => lastActive !== null && Date.now() - lastActive < SESSION_LENGTH;

let timer = null;
let registration = null;
let lastActive = null;
let authenticated = false;

let atExpires = null;
let rtExpires = null;
// session length in milliseconds
const SESSION_LENGTH = 10 * 1000;


document.getElementById('vat').addEventListener('click', () => invalidateAT());
document.getElementById('vrt').addEventListener('click', () => invalidateRT());
document.getElementById('users').addEventListener('click', () => showUsers());
document.getElementById('talk').addEventListener('click', () => talk());

document.getElementById('login').addEventListener('click', () => login());
document.getElementById('logout').addEventListener('click', () => logout());


document.addEventListener('click', () => {
  if (authenticated) {
    startIdleTimer();
  }
});


// await unregisterSW();
await registerSW();
