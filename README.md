# Raitaku
###### FA to Itaku Upload Tool

# Installation & Setup
Make sure you have the latest [Node.js](https://nodejs.org) installed (ignore the Docker instructions, unless you plan to use Docker). Next, go to the terminal for your OS of choice *(eg. PowerShell on Windows)*, and run the following commands:
```
git clone https://github.com/pecacheu/Raitaku
cd Raitaku
npm i
```

Rename `configExample.json` to `config.json`, and edit the config with your actual FA and Itaku auth tokens. You can find them using your browser's Dev Console.

**For FA:** Go to the Application tab and look under *Cookies -> furaffinity.net*. You only need to grab the values of 'a' and 'b', then paste them into the config under `faAuth`. The example config shows the format to use.

**For Itaku:** Go to the Network tab and look for an API call. The tricky part is simply finding one in the list among many random network requests. An good choice is `version.json`, as it gets called frequently. Try refreshing the page, then type it into the Filter box. Once you find it, check under the *Request Headers* section for a header called *Authorization*. The value should be in the format `Token XXXX`. Set `itAuth` in the config to this.

# Usage
**Note:** To find an FA post ID, check the last part of the URL, something like `/view/<faPostID>/`. For usernames, make sure to use them as they appear in the URL, not the nickname.

- `node raitaku transfer <faStartID> [faEndID] [skipWarnings] [bulkSets]` Transfer an FA post to your Itaku. *faEndID* is optional, provide it to run a bulk upload job. Set *skipWarnings* to `true` to auto-accept non-fatal warning prompts. By default, image sets (detected by the `<< PREV | NEXT >>` links in FA description) are uploaded to Itaku together. Set *bulkSets* to `false` to disable.
- `node raitaku faget <faPostID>` Parse & display FA post data.
- `node raitaku fagal <faUser> <page>` Parse & display FA gallery data.

You can also run any sub-command without arguments to see usage info.

# Customizing
Have a look at `raitaku.js` to add some customizations! Look for sections titled "Add your own special tag rules here" and "Add your own multi-tag rules here" to add custom tag rules. Have a look at the ones I added for an example of how they work.

## TODO
- Detect FA story submissions and Journals and convert to Itaku posts (Itaku needs to get their sh*t together on PDF uploads and advanced formatting first.)