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

- `node raitaku transfer <faPostID>` Transfer an FA post to your Itaku
- `node raitaku getfa <faPostID>` Parse & display FA post data

*Bulk upload feature coming soon!*