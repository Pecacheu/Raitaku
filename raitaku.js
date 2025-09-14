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
R_USR=/^\/*user\/(\w+)\/*$/, R_KEY=/[^\w]+/g, R_FN=/^\d+\.[^_]+_(.+)$/, R_TM=/[^\w]/g,
CMDS=['transfer', 'getfa'], TagCache={}, Arg=process.argv, print=console.log;
Arg.splice(0,2);

//============================================== FurAffinity API ==============================================

async function getFaPost(id) {
	print(C.dim("Loading FA #"+id));
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
		el=R_USR.exec(el.parentNode.attributes.href);
		if(!el) throw "Username Format";
		fa.user = el[1];
		el=dom.querySelector('.submission-title');
		if(!el) throw "Title";
		fa.title = el.textContent.trim();
		el=dom.querySelector('.submission-description');
		if(!el) throw "Desc";
		fa.desc = faDescToMd(el);
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
		//Get file
		fa.data = await httpReq(fa.file, 0, FA_AUTH, "GET", 1);
	} catch(e) {throw schema.errAt("FA Parse Error",e)}
	return fa;
}

function faDescToMd(sd) {
	let txt='',t,ss,se,n;
	sd=sd.childNodes;
	sd.each((e,i) => {
		if(e.tagName==='BR') {txt+='\n'; return}
		t=e.textContent, ss=t.startsWith(' '), se=t.endsWith(' ');
		if(ss && (n=sd[i-1]) && n.tagName==='BR') ss=0;
		if(se && (n=sd[i+1]) && n.tagName==='BR') se=0;
		t=t.trim();
		switch(e.tagName) {
			case 'I': case 'EM': t=`_${t}_`; break; //Italic
			case 'B': case 'STRONG': t=`**${t}**`; break; //Bold
			case 'S': t=`~~${t}~~`; break; //Strike
			case 'A':
				n=e.attributes.href;
				if(e.classList.contains('iconusername')) t=faAbsURL(n); //User
				else t=n===t?t:`[${t}](${faAbsURL(n)})`; //Link
		}
		txt += (ss?' ':'')+t+(se?' ':'');
	});
	return txt.trim();
}

function faAbsURL(url) {return new URL(url, FA_URI).toString()}

//============================================== Itaku API ==============================================

async function postItaku(fa) {
	let r=await convertTags(fa), tags=[], t;
	print(C.cyan(`Posting "${fa.title}" to Itaku`));
	for(t in r) tags.push(t); //Tags dict -> list
	if(tags.length < 5) throw `Not enough tags! (${tags.join(', ')})`;
	tags=tags.map(t => ({name:t}));
	switch(fa.rating) {
		case 'General': r='SFW'; break;
		case 'Mature': r='Questionable';
		default: r='NSFW';
	}
	fa.desc += `\n\n${fa.url}\n*Posted via Raitaku; Uploaded to FA on ${fa.date}*`;
	let fd=toFormData({title:fa.title, description:fa.desc, tags:tags, maturity_rating:r,
		sections:fa.folders, visibility:'PUBLIC', add_to_feed:true});
	fd.set('image', fa.data, fa.fn);
	return await httpReq(IT_API+"/galleries/images/", fd, IT_AUTH, "POST");
}

async function convertTags(fa) {
	print(C.cyan("Matching to Itaku tag IDs"));
	let tags={},te=[],p=[],t;
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
	if(t.aura && t.sensors) {
		delete t.aura, delete t.sensors;
		tags.aura_sensors=1;
	}
	if(t.living && t.gasm && t.drive) {
		delete t.living, delete t.gasm, delete t.drive;
		tags.lgd=1;
	}
	//Post Tags
	for(t in fa.tags) p.push(addTag(t,tags,te));
	await Promise.all(p);
	if(te.length) await promptWarn("Unknown tags: "+te.join(', '));
	return tags;
}

async function addTag(tag, tags, te) {
	//Special rules
	if(tag.startsWith('multi') && tag[5] && tag[5]!=='_') {
		tag='multi_'+tag.slice(5);
	}
	//Check cache
	let t=TagCache[tag=toKeyFmt(tag)];
	if(t) return tags[t]=1;
	//Check Itaku
	t=await httpReq(IT_API+"/tags", {name:tag, type:'images'}, IT_AUTH);
	let tm=tag.replace(R_TM,'');
	t=t.results.each(r => r.name.replace(R_TM,'')===tm?r:null);
	if(!t) return te.push(tag); //Tag not found
	if(t.synonymous_to) t=t.synonymous_to;
	t=t.name, TagCache[tag]=t;
	if(tag!==t) TagCache[t]=t;
	tags[t]=1;
}

//============================================== Support ==============================================

async function prompt(q) {
	let r=RL.createInterface({input:process.stdin, output:process.stdout});
	return new Promise(res => r.question(q, a => {r.close(),res(a)}));
}

async function promptWarn(w) {
	console.error(C.yellow(w));
	let a=(await prompt("Continue? (Y/N) ")).toLowerCase();
	if(a!=='y' && a!=='yes') throw w;
}

function toKeyFmt(s) {
	return s.trim().toLowerCase().replace(R_KEY,'_');
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

function usage(u) {print(C.red(`Usage: raitaku ${u?Arg[0]+' '+u:CMDS.join('|')}`))}

//============================================== Main ==============================================

switch(Arg[0]) {
	case 'transfer':
		if(Arg.length !== 2) usage("<faPostID>");
		else {
			let d=await postItaku(await getFaPost(Arg[1]));
			print(C.green(`Live at https://itaku.ee/images/${d.id}`));
		}
	break; case 'getfa':
		if(Arg.length !== 2) usage("<faPostID>");
		else print(await getFaPost(Arg[1]));
	break; default: usage();
}