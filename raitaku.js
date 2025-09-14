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
CMDS=['transfer', 'faget', 'fagal'], TagCache={}, Arg=process.argv, print=console.log;
Arg.splice(0,2);

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
			p={title:el.textContent.trim(), url:faAbsURL(p),
				id:p.slice(p.lastIndexOf('/')+1)};
			el=f.querySelector('img');
			if(!el) throw "Thumbnail";
			p.thumb = faAbsURL(el.attributes.src);
			fa.posts.push(p);
		});
	} catch(e) {throw schema.errAt(`Parse FA @${user} p${page}`,e)}
	return fa;
}

async function getFaPost(id, getFile=true) {
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
		if(getFile) fa.data = await httpReq(fa.file, 0, FA_AUTH, "GET", 1);
	} catch(e) {throw schema.errAt(`Parse FA #${id}`,e)}
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

async function postItaku(fa, wSkp) {
	if(fa.fn.endsWith('.swf')) throw "Flash not supported";
	let r=await convertTags(fa, wSkp), tags=[], t;
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

async function convertTags(fa, wSkp) {
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
	if(te.length) {
		te="Unknown tags: "+te.join(', ');
		if(wSkp) console.error(C.yellow(te));
		else await promptWarn(te);
	}
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
	t=await httpReq(IT_API+"/tags", {name:tag, type:'images'}, IT_AUTH);
	let tm=tag.replace(R_TM,'');
	t=t.results.each(r => r.name.replace(R_TM,'')===tm?r:null);
	if(!t) return te.push(tag); //Tag not found
	if(t.synonymous_to) t=t.synonymous_to;
	tags[t=t.name]=1, TagCache[tag]=t;
	if(tag!==t) TagCache[t]=t;
	print(C.dim(`Tag ${tag} -> ${t}`));
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

function usage(u) {print(C.red(`Usage: node raitaku ${u?Arg[0]+' '+u:CMDS.join('|')}`))}

//============================================== Main ==============================================

async function transfer(idSt, idEnd, wSkp) {
	if(!idEnd || idSt===idEnd) return postItaku(await getFaPost(idSt), wSkp);
	print(`Transferring posts from #${idSt} to #${idEnd}`);
	let d=await getFaPost(idSt, false), gal=[], pg=1, i,s,e,sp,ep;
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
			s=gal[pg].posts[i], d=await getFaPost(s.id);
			if(d.fn.endsWith('.swf')) { //Use thumbnail for SWF
				d.data = await httpReq(s.thumb, 0, FA_AUTH, "GET", 1);
				d.fn += path.extname(s.thumb);
			}
			d.fn+='.jpg';
			d=await postItaku(d, wSkp);
			print(C.green(`Live at https://itaku.ee/images/${d.id}`));
		}
		if(pg>1) i=gal[pg-1].posts.length-1;
	}
}

switch(Arg[0]) {
	case 'transfer':
		if(Arg.length<2 || Arg.length>4) usage("<faStartID> [faEndID] [skipWarnings]");
		else await transfer(Arg[1], Arg[2], Arg[3]==='true');
	break; case 'faget':
		if(Arg.length !== 2) usage("<faPostID>");
		else print(await getFaPost(Arg[1], false));
	break; case 'fagal':
		if(Arg.length !== 3) usage("<faUser> <page>");
		else print(await getFaGallery(Arg[1], Arg[2]));
	break; default: usage();
}