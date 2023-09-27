const foo = (av) => {
  return fetch(av ?? 'https://folio-snapshot-okapi.dev.folio.org/saml/check', { headers: { 'x-okapi-tenant': 'diku' } })
    .then(response => { });
}


const registerSW = async () => {
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('sw.js', { scope: './' });

      console.log('registration', registration);
      if (registration.installing) {
        console.log('=> Service worker installing');
      } else if (registration.waiting) {
        console.log('=> Service worker installed');
      } else if (registration.active) {
        console.log('=> Service worker active');
      }

      navigator.serviceWorker.addEventListener("message", (e) => {
        console.info('<= message', e.data)
      });
    } catch (error) {
      console.error(`=> Registration failed with ${error}`);
    }
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

const startAccessTokenTimer = () => {
  if (timer) {
    clearTimeout(timer);
  }
  console.log('resetting lastActive')
  lastActive = Date.now();
  timer = setTimeout(handleAccessTokenTimeout, SESSION_LENGTH);
}

const rotateAccessToken = () => foo('cookie-vrt');

const handleAccessTokenTimeout = () => {
  try {
    if (isActive()) {
      console.log('at timeout; rotating')
      rotateAccessToken()
        // .then(startAccessTokenTimer)
        .catch(e => {
          console.error('rtr failure')
          throw e;
        });
    } else {
      throw(`no activity since ${new Date(lastActive).toISOString()}`)
    }
  } catch (e) {
    console.log('handleActivityTimeout TIMED OUT', e);
    logout();
  }
};

const getUsers = () => {
  const offset = Math.floor(Math.random() * 350);
  return fetch(`https://folio-snapshot-2-okapi.dev.folio.org/users?limit=1&offset=${offset}`, {
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
  fetch('https://folio-snapshot-2-okapi.dev.folio.org/bl-users/login-with-expiry', {
    method: 'POST',
    headers: {
      'x-okapi-tenant': 'diku',
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
      startAccessTokenTimer();

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
    sw.postMessage([`Hola ${new Date().toISOString()}`]);
  }
};

/**
 * has there been activity
 * @returns boolean
 */
const isActive = () => lastActive !== null && Date.now() - lastActive < SESSION_LENGTH;

let count = 0;
let timer = null;
let registration = null;
let lastActive = null;
let authenticated = false;
// session length in milliseconds
const SESSION_LENGTH = 10 * 1000;


// document.getElementById('a').addEventListener('click', () => foo())
document.getElementById('vat').addEventListener('click', () => foo('cookie-vat'))
document.getElementById('vrt').addEventListener('click', () => foo('cookie-vrt'))
document.getElementById('foo').addEventListener('click', () => foo('cookie-foo'))
document.getElementById('users').addEventListener('click', () => showUsers())
document.getElementById('talk').addEventListener('click', () => talk())

document.getElementById('login').addEventListener('click', () => login())
document.getElementById('logout').addEventListener('click', () => logout())


document.addEventListener('click', () => {
  if (authenticated) {
    startAccessTokenTimer();
  }
});


// await unregisterSW();
await registerSW();
