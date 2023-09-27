# Okapi RTR service worker

run `npx lite-server .` to play with RTR

## How?
This POC installs a service worker (SW) that intercepts fetches and handles
RTR for those directed to Okapi.
1. authenticate: provide credentials and click the "login" button
2. test RTR
    * open Developer tools and observe the JS console
    * click the "fetch users" button
    * click the "expire AT" button to force RTR
    * click the "fetch users" button

## Notes
* In production, session length would be set by the refresh-token's TTL but here it's limited to ten seconds. The session auto-extends via an event-handler that detects activity (here, clicks). The countdown-timer starts on login and then is restarted each time the event-handler detects activity. IOW, click every nine seconds and the session stays alive, or wait ten seconds and be logged out automatically. Set `SESSION_LENGTH` in `app.js` if you want to adjust the session length.

* In SW parlance, the SW immediately activates. Normally, an SW only attaches to resources that load _after_ the SW loads, but that would mean we wouldn't get RTR until after the page was reloaded (SWs are persistent).
* In SW parlance, the SW claims all clients. This is basically "last one wins", so when multiple tabs/pages are opened, the SW created by the last one grabs control over all open tabs/pages.

## service worker resources

* https://mdn.github.io/dom-examples/service-worker/simple-service-worker/
* [using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
* ["Why is my service worker failing to register?"](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers#Why_is_my_service_worker_failing_to_register)
* [Service worker lifecycle deep dive](https://web.dev/service-worker-lifecycle/)
* [inter-worker communication](https://mdn.github.io/dom-examples/web-workers/simple-web-worker/)
