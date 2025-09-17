//Raitaku Upload Tool by Pecacheu; GNU GPLv3

import fs from 'fs/promises';
import path from 'path';
import RL from 'readline';
import C from 'chalk';
import { parse } from 'node-html-parser';
import schema from 'raiutils/schema';
import 'raiutils';

const ConfFmt={faAuth:{t:'str'}, itAuth:{t:'str'}}, App=import.meta.dirname,
Conf=JSON.parse(await fs.readFile(path.join(App, "config.json")));
schema.checkSchema(Conf, ConfFmt);

const FA_AUTH={cookie:Conf.faAuth}, IT_AUTH={authorization:Conf.itAuth},
FA_URI="https://www.furaffinity.net", IT_API="https://itaku.ee/api",
R_ID=/(?:user|view)\/(\w+)\/*$/, R_FN=/^\d+\.[^_]+_(.+)$/, R_KEY=/[^\w]+/g,
R_KTR=/^_+|_+$/g, R_TM=/[^\w]/g, CMDS=['transfer', 'faget', 'fagal'],
TagCache={}, UserCache={}, PostedIDs={}, Arg=process.argv, print=console.log;
Arg.splice(0,2);
let SkipWarn;

//============================================== FurAffinity API ==============================================

async function getFaGallery(user, page=1) {
	print(C.dim(`Loading FA Gallery @${user} p${page}`));
	let fa={url:`${FA_URI}/gallery/${user}/${page}`, user, page, posts:[]};
	try {
		//Fetch page
		let dom=await httpReq(fa.url, 0, FA_AUTH);
		dom=parse(dom);
		//Read posts
		let el=dom.querySelector('section.gallery'),p;
		if(!el) throw "Gallery List";
		el.querySelectorAll('figure').forEach(f => {
			el=f.querySelector('figcaption a');
			if(!el) throw "Caption";
			p=el.attributes.href;
			if(p.endsWith('/')) p=p.slice(0,-1);
			p={title:el.textContent.trim(), url:faAbsURL(p), id:R_ID.exec(p)[1]};
			el=f.querySelector('img');
			if(!el) throw "Thumbnail";
			p.thumb = faAbsURL(el.attributes.src);
			fa.posts.push(p);
		});
	} catch(e) {throw schema.errAt(`Parse FA @${user} p${page}`,e)}
	return fa;
}

async function getFaPost(id) {
	print(C.magenta("Loading FA #"+id));
	let fa={url:`${FA_URI}/view/${id}`};
	try {
		//Fetch post
		let dom=await httpReq(fa.url, 0, FA_AUTH);
		dom=parse(dom);
		//File info
		let el=dom.querySelector('.favorite-nav');
		if(!el) throw "Navbar";
		el=el.children.each(e => e.textContent==="Download"?e:null);
		if(!el) throw "Download button";
		el=el.attributes.href;
		fa.file = faAbsURL(el);
		el=el.slice(el.lastIndexOf('/')+1);
		let fn=R_FN.exec(el);
		fa.fn = fn?fn[1]:el;
		//Post info
		el=dom.querySelector('.submission-user-icon');
		if(!el) throw "User Icon";
		el=R_ID.exec(el.parentNode.attributes.href);
		if(!el) throw "Username Format";
		fa.user = el[1];
		el=dom.querySelector('.submission-title');
		if(!el) throw "Title";
		fa.title = el.textContent.trim();
		el=dom.querySelector('.submission-description');
		if(!el) throw "Desc";
		fa.desc = await faDescToMd(el, fa);
		el=dom.querySelector('meta[name=twitter:data1]');
		if(!el) throw "Date";
		fa.date = el.attributes.content.trim();
		el=dom.querySelector('.category-name');
		if(!el) throw "Category";
		fa.cat = el.textContent.trim();
		el=dom.querySelector('.type-name');
		if(!el) throw "Type";
		fa.type = el.textContent.trim();
		el=dom.querySelector('.info');
		if(!el) throw "Info";
		el.children.forEach(e => {
			el=e.querySelector('.highlight');
			if(!el) throw "Section";
			el=toKeyFmt(el.textContent);
			if(el==='category') return;
			fa[el] = e.lastChild.textContent.trim();
		});
		//Stats
		el=dom.querySelector('.stats-container');
		if(!el) throw "Stats";
		el.children.forEach(e => {
			el=toKeyFmt(e.classList.value[0]);
			fa[el] = e.firstElementChild.textContent.trim();
		});
		//Tags
		el=dom.querySelector('.tags-row');
		if(!el) throw "Tags";
		fa.tags = {};
		el.querySelectorAll('.tags').forEach(e =>
			fa.tags[toKeyFmt(e.textContent)]=1);
		//Folders
		el=dom.querySelector('.folder-list-container');
		fa.folders = [];
		if(el) el.children.forEach(e => {
			if(e.tagName!=='DIV') return;
			e=e.querySelector('span');
			if(!e) throw "Folder Name";
			fa.folders.push(e.textContent.trim());
		});
	} catch(e) {throw schema.errAt(`Parse FA #${id}`,e)}
	return fa;
}

async function getFaUser(user) {
	print(C.dim(`Loading FA User @${user}`));
	let fa={url:`${FA_URI}/user/${user}`, user};
	try {
		//Fetch page
		let dom=await httpReq(fa.url, 0, FA_AUTH);
		dom=parse(dom);
		//Read info
		let el=dom.querySelector('.user-contact'),p;
		if(!el) throw "Contacts";
		fa.contacts = {};
		el.querySelectorAll('.user-contact-item').forEach(c => {
			el=c.querySelector('strong');
			if(!el) throw "Contact Name";
			el=toKeyFmt(el.textContent);
			c=c.querySelector('a');
			if(!c) throw "Contact Link";
			c=c.textContent;
			if(el!=='website' && el!=='email') c=toKeyFmt(c);
			if(c!=='ask') fa.contacts[el]=c;
		});
	} catch(e) {throw schema.errAt(`Parse FA @${user} p${page}`,e)}
	return fa;
}

async function faDescToMd(sd, fa) {
	sd=sd.childNodes;
	let txt='',i=0,l=sd.length, t,ss,se,n,e;
	for(; i<l; ++i) {
		e=sd[i];
		if(e.tagName==='BR') {txt+='\n'; continue}
		t=e.textContent, ss=t.startsWith(' '), se=t.endsWith(' ');
		if(ss && (n=sd[i-1]) && n.tagName==='BR') ss=0;
		if(se && (n=sd[i+1]) && n.tagName==='BR') se=0;
		t=t.trim();
		switch(e.tagName) {
			case 'I': case 'EM': t=`_${t}_`; break; //Italic
			case 'B': case 'STRONG': t=`**${t}**`; break; //Bold
			case 'S': t=`~~${t}~~`; break; //Strike
			case 'SPAN':
			if(e.classList.contains('parsed_nav_links')) { //Nav Links
				if(!fa.set) {
					fa.set={};
					e.querySelectorAll('a').each(a => {
						fa.set[toKeyFmt(a.textContent)] = R_ID.exec(a.attributes.href)[1];
					});
				}
				continue;
			}
			break; case 'A':
			n=e.attributes.href;
			if(e.classList.contains('iconusername')) { //User
				n=R_ID.exec(n)[1], t=0;
				if(UserCache[n]==null) { //FA -> Itaku User
					let fc=await getFaUser(n), cl={[n]:1}, u;
					if(fc) {
						fc=fc.contacts;
						delete fc.website, delete fc.email;
						for(u in fc) cl[fc[u]]=1;
						for(u in cl) try {
							u=await getItakuUser(u);
							t='@'+(UserCache[n]=u.owner_username), n=0;
							break;
						} catch(e) {}
					} else {
						UserCache[n]=0;
						warn(`No such user '${n}'`);
					}
				} else if(UserCache[n]) t='@'+UserCache[n], n=0; //From Cache
			}
			if(n) t=n===t?t:`[${t}](${faAbsURL(n)})`; //Link
		}
		txt += (ss?' ':'')+t+(se?' ':'');
	}
	return txt.trim();
}

function faAbsURL(url) {return new URL(url, FA_URI).toString()}
function loadFaImg(url) {return httpReq(url, 0, FA_AUTH, "GET", 1)}

//============================================== Itaku API ==============================================

async function getItakuUser(user) {
	print(C.dim(`Loading Itaku User @${user}`));
	return await httpReq(IT_API+`/user_profiles/${user}/`, 0, IT_AUTH);
}

async function newItakuImg(fa) {
	print(C.cyan(`Posting "${fa.title}" to Itaku`));
	if(fa.cat==='Story') return promptWarn("Stories not yet supported on Itaku");
	if(fa.fn.endsWith('.swf')) return promptWarn("Flash not supported");
	let it=await convertTags(fa), tags=[], t,r;
	for(t in it) tags.push(t); //Tags dict -> list
	if(tags.length < 5) throw `Not enough tags! (${tags.join(', ')})`;
	tags=tags.map(t => ({name:t}));
	switch(fa.rating) {
		case 'General': r='SFW'; break;
		case 'Mature': r='Questionable'; break;
		default: r='NSFW';
	}
	fa.desc += `\n\n${fa.url}\n*Posted via Raitaku; Uploaded to FA on ${fa.date}*`;
	let fd=toFormData({title:fa.title, description:fa.desc, tags, maturity_rating:r,
		sections:fa.folders, visibility:'PUBLIC'});
	if(!fa.set) fd.set('add_to_feed', true);
	fd.set('image', fa.data, fa.fn);
	r=await httpReq(IT_API+"/galleries/images/", fd, IT_AUTH, "POST");
	print(C.green(`Live at https://itaku.ee/images/${r.id}`));
	r.newTags=it, PostedIDs[fa.id]={id:r.id, newTags:it};
	return r;
}

async function newItakuPost(dat) {
	print(C.bgMagenta(`Posting Itaku set "${dat.title}"`));
	let tags=[],r,t;
	for(t in dat.tags) tags.push({name:t}); //Tags dict -> list
	dat.ids.forEach((d,i) => dat.ids[i]=Number(d));
	switch(dat.rating) {
		case 'General': r='SFW'; break;
		case 'Mature': r='Questionable'; break;
		default: r='NSFW';
	}
	r=await httpReq(IT_API+"/posts/", {title:dat.title, content:dat.desc||'', tags,
		maturity_rating:r, gallery_images:dat.ids, visibility:'PUBLIC'}, IT_AUTH, "POST");
	print(C.green(`Live at https://itaku.ee/posts/${r.id}`));
	return r;
}

async function convertTags(fa) {
	print(C.cyan("Matching to Itaku tag IDs"));
	let tags={},te=[],t;
	//Info Tags
	switch(fa.cat) {
		case 'Artwork (Digital)': tags.digital_art=1; break;
		case 'Artwork (Traditional)': tags.traditional_art=1; break;
		case 'YCH / Sale': tags.ych=1; break;
		case 'All': case 'Other': break;
		default: await addTag(fa.cat, tags, te);
	}
	switch(fa.type) {
		case 'General Furry Art': tags.furry=1; break;
		case 'Animal related (non-anthro)': tags.animal=1; break;
		case 'Comics': tags.comic=1; break;
		case 'Tutorials': tags.tutorial=1; break;
		case 'Fat Furs': tags.fatfur=1; break;
		case 'Gore / Macabre Art': tags.gore=1; break;
		case 'Macro / Micro': tags.size_difference=1; break;
		case 'My Little Pony / Brony': tags.my_little_pony=1; break;
		case 'TF / TG': tags.tgtf=1; break;
		case 'Other Music': tags.music=1; break;
		case 'All': case 'Miscellaneous': case 'Fetish Other': break;
		default: await addTag(fa.type, tags, te);
	}
	if(fa.species!=='Unspecified / Any') await addTag(fa.species, tags, te);
	//Special rules
	t=fa.tags;
	if(t.multiple) delete t.multiple, t.multi=1;
	if(t.aura && t.sensors) {
		delete t.aura, delete t.sensors;
		tags.aura_sensors=1;
	}
	if(t.living && t.gasm && t.drive) {
		delete t.living, delete t.gasm, delete t.drive;
		tags.lgd=1;
	}
	//Post Tags
	for(t in fa.tags) await addTag(t,tags,te);
	if(te.length) await promptWarn("Unknown tags: "+te.join(', '));
	return tags;
}

async function addTag(tag, tags, te) {
	//Special rules
	if(!tag.startsWith('multiple') && tag.startsWith('multi')
		&& tag[5] && tag[5]!=='_') tag='multi_'+tag.slice(5);
	//Check cache
	let t=TagCache[tag=toKeyFmt(tag)];
	if(t) return tags[t]=1;
	//Check Itaku
	t=await httpReq(IT_API+"/tags/", {name:tag, type:'images'}, IT_AUTH);
	let tm=tag.replace(R_TM,'');
	t=t.results.each(r => r.name.replace(R_TM,'')===tm?r:null);
	if(!t) return te.push(tag); //Tag not found
	if(t.synonymous_to) t=t.synonymous_to;
	tags[t=t.name]=1, TagCache[tag]=t;
	if(tag!==t) TagCache[t]=t;
	print(C.dim(`Tag ${tag} -> ${t}`));
}

//============================================== Support ==============================================

function warn(w) {console.error(C.yellow(w))}

async function prompt(q) {
	let r=RL.createInterface({input:process.stdin, output:process.stdout});
	return new Promise(res => r.question(q, a => {r.close(),res(a)}));
}

async function promptWarn(w) {
	warn(w);
	if(SkipWarn) return;
	let a=(await prompt("Continue? (Y/N) ")).toLowerCase();
	if(a!=='y' && a!=='yes') throw w;
}

function toKeyFmt(s) {
	return s.toLowerCase().replace(R_KEY,'_').replace(R_KTR,'');
}

function toFormData(obj) {
	let fd=new FormData(),k;
	for(k in obj) fd.set(k, typeof obj[k]==='string'?
		obj[k]:JSON.stringify(obj[k]));
	return fd;
}

async function httpReq(uri, data, hdr, meth='GET', blob) {
	let r={method:meth, headers:hdr||{}};
	if(meth!=='GET' && data) {
		if(data instanceof FormData) r.body=data;
		else {
			r.headers["content-type"]='application/json';
			r.body=JSON.stringify(data);
		}
	} else uri+='?'+utils.toQuery(data);
	r=await fetch(new Request(uri,r));
	if(r.status!==200 && r.status!==201) {
		let b=await r.text(), q=uri.indexOf('?');
		if(q!==-1) uri=uri.slice(0,q);
		throw `Code ${r.status}${b&&b.length<500?` (${b})`:''} @ ${uri}`;
	}
	if(blob) return await r.blob();
	r=await r.text();
	if(r.startsWith('{')) r=JSON.parse(r);
	return r;
}

function usage(u) {print(C.red(`Usage: node raitaku ${u?Arg[0]+' '+u:CMDS.join('|')}`))}

//============================================== Main ==============================================

async function transferOne(id, doSets) {
		if(PostedIDs[id]) return print(C.dim(`#${id} Already posted`));
		let fa=await getFaPost(id); //Download
		if(doSets && fa.set) { //Set / Comic
			//Find first post
			while(1) {
				id=fa.set.first||fa.set.prev;
				if(!id) break;
				fa=await getFaPost(id);
				if(!fa.set) throw "Error while following image set chain";
			}
			print(C.bgMagenta(`Found an image set starting at "${fa.title}"`));
			//Upload all
			let ids=[],tags={},fp=fa, d,t;
			while(1) {
				if(d=PostedIDs[id]) { //Already posted
					if(ids.indexOf(d.id)!==-1) {warn("Recursive loop; Breaking cycle"); break}
				} else { //New post
					fa.data = await loadFaImg(fa.file);
					d=await newItakuImg(fa);
				}
				ids.push(d.id);
				for(t in d.newTags) tags[t]=1;
				if(!fa.set || !(id=fa.set.next)) break;
				fa=await getFaPost(id);
			}
			//Create post set
			return newItakuPost({title:fp.title, desc:fp.desc,
				rating:fp.rating, tags, ids});
		}
		fa.data = await loadFaImg(fa.file); //Get file
		return newItakuImg(fa); //Upload
}

async function transfer(idSt, idEnd, doSets) {
	if(!idEnd || idSt===idEnd) return transferOne(idSt, doSets);
	print(`Transferring posts from #${idSt} to #${idEnd}`);
	let d=await getFaPost(idSt), gal=[], pg=1, i,s,e,sp,ep;
	for(; !sp || !ep; ++pg) {
		i=(gal[pg] = await getFaGallery(d.user, pg)).posts;
		if(!i.length) throw "Target post(s) not found!";
		if(!sp) { //Find start
			s=i.each((p,i) => p.id===idSt?i:null);
			if(s!=null) print(C.yellow(`Found start #${idSt} on page`, sp=pg));
		}
		if(!ep) { //Find end
			e=i.each((p,i) => p.id===idEnd?i:null);
			if(e!=null) print(C.yellow(`Found end #${idEnd} on page`, ep=pg));
		}
	}
	if(ep>sp || (ep===sp && e>s)) i=s,s=e,e=i, i=sp,sp=ep,ep=i; //Swap start & end
	for(i=s,pg=sp; pg>=ep; --pg) { //Pages
		print(C.yellowBright("-- Page", pg));
		for(sp=(pg===ep?e:0); i>=sp; --i) { //Posts
			await transferOne(gal[pg].posts[i].id, doSets);
		}
		if(pg>1) i=gal[pg-1].posts.length-1;
	}
}

switch(Arg[0]) {
	case 'transfer':
		if(Arg.length<2 || Arg.length>4) usage("<faStartID> [faEndID] [skipWarnings] [bulkSets]");
		else {
			SkipWarn = Arg[3]==='true';
			await transfer(Arg[1], Arg[2], Arg[4]!=='false');
		}
	break; case 'faget':
		if(Arg.length !== 2) usage("<faPostID>");
		else print(await getFaPost(Arg[1]));
	break; case 'fagal':
		if(Arg.length !== 3) usage("<faUser> <page>");
		else print(await getFaGallery(Arg[1], Arg[2]));
	break; default: usage();
}