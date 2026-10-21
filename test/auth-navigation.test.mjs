import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedSignInURL} from '../desktop/auth-navigation.mjs';
test('sign-in windows stay on their own platform and Google account origins',()=>{assert.equal(allowedSignInURL('https://accounts.google.com/signin','youtube'),true);assert.equal(allowedSignInURL('https://www.twitch.tv/login','twitch'),true);assert.equal(allowedSignInURL('https://www.tiktok.com/login','tiktok'),true);for(const url of ['http://www.twitch.tv/login','https://twitch.tv.evil.test','https://eviltwitch.tv','javascript:alert(1)','file:///C:/test'])assert.equal(allowedSignInURL(url,'twitch'),false);assert.equal(allowedSignInURL('https://www.twitch.tv','youtube'),false);});
