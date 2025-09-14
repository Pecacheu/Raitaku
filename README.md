# Raitaku
###### FA to Itaku Upload Tool

# Installation & Setup

Make sure you have a recent version of [Node.js](https://nodejs.org) installed. In the Raitaku directory, run:

```
npm i
```

Rename `configExample.json` to `config.json`, and edit the config with your actual FA and Itaku auth tokens. You can find them using your browser's Dev Console.

**For FA:** Go to the Application tab and look under *Cookies -> furaffinity.net*. You only need to grab the values of 'a' and 'b'.

**For Itaku:** Go to the Network tab and look for an API call, then check the *Request Headers* section for the value of the *Authorization* header. It should be in the format "Token XXXX". The tricky part is finding an API call in the list among many random network requests. One option that's easy to find is "version.json", as it gets called frequently. Try refreshing the page and it should pop up.

# Usage

**Note:** To find an FA post ID, check the last part of the URL, something like `/view/<faPostID>/`. For usernames, make sure to use them as they appear in the URL, not the nickname.

- `node raitaku transfer <faStartID> [faEndID] [skipWarnings]` Transfer an FA post to your Itaku. *faEndID* is optional, provide it to run a bulk upload job. Set *skipWarnings* to `true` to auto-accept non-fatal warning prompts.
- `node raitaku faget <faPostID>` Parse & display FA post data.
- `node raitaku fagal <faUser> <page>` Parse & display FA gallery data.

You can also run any sub-command without arguments to see usage info.