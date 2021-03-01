import {default as schema} from '../schema.json';
import Ajv from 'ajv';

declare type CaptionTime = {
	start: string,
	end: string,
};

declare type CaptionItem = {
	line: string,
	time?: CaptionTime,
	speaker?: string[],
	position?:number,
	align?:'start'|'center'|'end',
};

declare type JsonLdTypeCaptions = {
	"@type": "ItemList",
	itemListElement: {
		'@type': 'ListItem',
		position: number,
		item: CaptionItem,
	}[],
};

declare type JsonLdTypeTranslation<T> = {
	"@type": "CreativeWork",
	about: JsonLdTypeCaptions,
	inLanguage: T&string,
};

declare type JsonLdType = JsonLdTypeTranslation<'en'|'en-GB'|'en-US'>&{
	"@context": "https://schema.org",
	"@type": "CreativeWork",
	about: JsonLdTypeCaptions,
	url: string,
	inLanguage:'en'|'en-GB'|'en-US',
	translationOfWork?:JsonLdTypeTranslation<string>[]
};

const templates:{[key:string]:HTMLTemplateElement} = {};
const main = document.body.querySelector('main') as HTMLElement;
const validator = (new Ajv()).compile(schema);

class VideoId
{
	type:'youtube'|'twitch';

	id:string;

	constructor(type:'youtube'|'twitch', id:string)
	{
		this.type = type;
		this.id = id;
	}

	toString() : string
	{
		if ('youtube' === this.type) {
			return `https://youtu.be/${this.id}`;
		}

		return `https://clips.twitc.tv/${this.id}`;
	}
}

const numeric = /^\d+(?:\.\d+)?$/;

class CaptionLineSetting
{
	private _speaker:string = '';

	private _start:string = '';

	private _end:string = '';

	private _position:number|null = null;

	alignment:'start'|'center'|'end'|null = null;

	get speaker() : string
	{
		return this._speaker;
	}

	set speaker(value:string)
	{
		this._speaker = value.trim().split(',').map(
			(e) => {
				return e.trim();
			}
		).filter((e) => {
			return '' !== e.trim();
		}).join(',');
	}

	get start () : string {
		return this._start;
	}

	set start(value:string)
	{
		if ( ! numeric.test(value)) {
			throw new Error(
				`CaptionLineSetting.start must be numeric!`
			);
		}

		this._start = value;
	}

	get end () : string {
		return this._end;
	}

	set end(value:string)
	{
		if ( ! numeric.test(value)) {
			throw new Error(
				`CaptionLineSetting.end must be numeric!`
			);
		}

		this._end = value;
	}

	get position() : number|null
	{
		return this._position;
	}

	set position(value:number|null)
	{
		if (null === value) {
			this._position = null;
		} else if ('number' === typeof(value)) {
			this._position = Math.max(0, value) | 0;
		} else {
			this._position = Math.max(0, parseFloat(value)) | 0;
		}
	}

	constructor(
		speaker:string,
		start:string,
		end:string,
		position:number|string|null = null,
		alignment:'start'|'center'|'end'|null = null
	) {
		this.start = start;
		this.end = end;
		this.speaker = speaker;
		this.position = (
			'string' === typeof(position)
				? parseFloat(position)
				: position
		);
		this.alignment = alignment;
	}
}

(
	[...document.head.querySelectorAll(
		'template[id]'
	)] as HTMLTemplateElement[]
).forEach((e) => {
	templates[e.id] = e;
});

function clone_template(id:string) : DocumentFragment
{
	if ( ! (id in templates)) {
		throw new Error(
			`Argument 1 passed to clone_template() was not a supported id (${
				id
			})`
		);
	}

	return templates[id].content.cloneNode(true) as DocumentFragment;
}

function load_await_url() : void
{
	const await_url = clone_template('submit-url-screen');
	const url = await_url.querySelector('input') as HTMLInputElement|undefined;
	const form = await_url.querySelector('form') as HTMLFormElement|undefined;
	const regex = /^(?:https?:\/\/(?:www\.)?)?(?:(?:youtu\.be\/|youtube\.com\/watch\?v=)(?<youtubeid>[a-zA-Z0-9_\-]{11})|clips\.twitch\.tv\/(?<twitchid>[a-zA-Z0-9]+))/;

	if ( ! url) {
		throw new Error('Could not find URL input!');
	} else if ( ! form ) {
		throw new Error(
			'Could not find form!'
		);
	}

	url.setAttribute('pattern', regex.toString().substr(1).replace(/\/$/, ''));
	form.addEventListener('submit', async (e) => {
		e.preventDefault();

		const match = regex.exec(url.value) as null|{groups: {
			youtubeid:string|undefined,
			twitchid:string|undefined,
		}};

		if ( ! match) {
			throw new Error(
				'Could not find usable url!'
			);
		}

		let id:VideoId;

		if (match.groups.youtubeid) {
			id = new VideoId('youtube', match.groups.youtubeid);
		} else if(match.groups.twitchid) {
			id = new VideoId('twitch', match.groups.twitchid);
		} else {
			throw new Error(
				'No supported match found despite matching with regex!'
			);
		}

		const args:[VideoId, [string, CaptionLineSetting?][]?] = [id];

		const data = new FormData(form);

		const json = data.get('json') + '';
		const xml = data.get('xml') + '';
		const sbv = data.get('sbv') + '';
		const txt = data.get('txt') + '';

		if (json.length > 0) {
			let json_data:JsonLdType;

			try {
				json_data = JSON.parse(json);

				await validator(json_data);

				args[1] = json_data.about.itemListElement.sort((a, b) => {
					return a.position - b.position;
				}).map((line_data) => {
					const start = (line_data.item.time as CaptionTime).start;
					const end = (line_data.item.time as CaptionTime).end;

					return [line_data.item.line, new CaptionLineSetting(
						(line_data.item.speaker || []).join(', '),
						start.replace(/^PT(.+)S$/, '$1'),
						end.replace(/^PT(.+)S$/, '$1'),
						line_data.item.position || null,
						line_data.item.align || null
					)];
				});
			} catch (error) {
				console.error(error);

				if (validator.errors) {
					console.error(validator.errors);
					throw new Error('Could not parse JSON')
				}

				throw new Error('Could not load JSON');
			}
		} else if (xml.length > 0) {
			const doc = (new DOMParser()).parseFromString(
				xml,
				'application/xml'
			);

			args[1] = [...doc.querySelectorAll('transcript > text')].map(
				(line) : [string, CaptionLineSetting?] => {
					const start = line.getAttribute('start') + '';
					const end = (
						parseFloat(start)
						+ parseFloat(
							line.getAttribute('dur') + ''
						)
					);
					const placeholder = document.createElement('span');
					placeholder.innerHTML = line.textContent + '';

					return [
						placeholder.textContent as string,
						new CaptionLineSetting(
							'',
							start,
							end.toString(10)
						)
					];
				}
			);
		} else if (sbv.length > 0) {
			args[1] = sbv.split(/(?:\r?\n){2}/).map((line) => {
				const [time, ...caption] = line.split(/\r?\n/);

				const [start, end] = time.split(',').map(
					(time_string) : string => {
						const [hours, minutes, seconds] = time_string.split(
							':'
						);
						return (
							(parseInt(hours, 10) * 3600)
							+ (parseInt(minutes) * 60)
							+ parseFloat(seconds)
						).toString(10);
					}
				);

				return [caption.join("\n").trim(), new CaptionLineSetting('', start, end)];
			});
		} else if (txt.length > 0) {
			args[1] = txt.split("\n").map((line) => {
				return [line.trim()];
			});
		}

		load_editor(...args);
	});

	main.textContent = '';
	main.appendChild(await_url);
}

function load_editor(
	id:VideoId,
	captions:[string, CaptionLineSetting?][] = []
) : void
{
	const node = clone_template('editor');
	const editor = node.querySelector('[contenteditable]') as HTMLElement|null;
	const embed = node.querySelector('.embed') as HTMLElement|null;
	const script = node.querySelector('#json-ld') as HTMLTextAreaElement|null;
	const webvtt = node.querySelector('#webvtt') as HTMLTextAreaElement|null;
	const form = node.querySelector('form') as HTMLFormElement|null;
	const settings:WeakMap<Node, CaptionLineSetting> = new WeakMap();
	let caption_line:Text|HTMLElement|null;

	if (
		! editor
		|| ! embed
		|| ! script
		|| ! form
		|| ! webvtt
	) {
		throw new Error(
			'Required components of editor not found!'
		);
	}

	const form_speaker = (
		form.querySelector('#speaker') as HTMLInputElement|null
	);
	const form_start = (
		form.querySelector('#start-time') as HTMLInputElement|null
	);
	const form_end = (
		form.querySelector('#end-time') as HTMLInputElement|null
	);
	const form_position = (
		form.querySelector('#position') as HTMLInputElement|null
	);
	const form_alignment = (
		form.querySelector('#alignment') as HTMLInputElement|null
	);

	if (
		! form_speaker
		|| ! form_start
		|| ! form_end
		|| ! form_position
		|| ! form_alignment
	) {
		throw new Error(
			'Required components of form not found!'
		);
	}

	const iframe = document.createElement('iframe') as HTMLIFrameElement;

	iframe.setAttribute('type', 'text/html');
	iframe.setAttribute('frameborder', '0');
	iframe.setAttribute('allowfullscreen', 'false');

	if ('youtube' === id.type) {
		const urlparams = new URLSearchParams({
			autoplay: '0',
			enablejsapi: '0',
			fs: '0',
			modestbranding: '0',
			playsinline: '1',
		});

		iframe.src = `https://www.youtube.com/embed/${id.id}?${urlparams}`;
	} else {
		const urlparams = new URLSearchParams({
			clip: id.id,
			preload: 'metadata',
			parent: location.hostname,
		});

		iframe.src = `https://clips.twitch.tv/embed?${urlparams}`;
	}

	embed.appendChild(iframe);

	function update_jsonld() : JsonLdType
	{
		const iterator = document.createNodeIterator(
			editor as HTMLElement,
			NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
		);

		const jsonld:JsonLdType = {
			"@context": "https://schema.org",
			'@type': 'CreativeWork',
			inLanguage: 'en',
			url: id + '',
			about: {
			"@type": "ItemList",
			itemListElement: [
				] as {
					'@type': 'ListItem',
					position: number,
					item: CaptionItem,
				}[]
			}
		};

		let currentNode;
		let index = 0;

		while (currentNode = iterator.nextNode()) {
			if (
				currentNode === editor
				|| '' === (currentNode.textContent?.trim() + '')
			) {
				continue;
			} else if (currentNode instanceof Text) {
				let item:CaptionItem = {
					line: currentNode.textContent + '',
				};

				if (settings.has(currentNode)) {
					const setting = settings.get(
						currentNode
					) as CaptionLineSetting;

					item.time = {
						start: `PT${setting.start}S`,
						end: `PT${setting.end}S`,
					};

					if ('' !== setting.speaker) {
						item.speaker = setting.speaker.split(',').map(
							(e) => {
								return e.trim();
							}
						);
					}

					if (null !== setting.position) {
						item.position = setting.position;
					}

					if (null !== setting.alignment) {
						item.align = setting.alignment;
					}
				}

				jsonld.about.itemListElement.push({
					'@type': 'ListItem',
					position: index,
					item,
				});

				++index;
			}
		}

		(
			script as HTMLTextAreaElement
		).textContent = JSON.stringify(jsonld, null, "\t");

		return jsonld;
	}

	function webvtt_time(value:number) : string
	{
		const minutes = Math.floor(value / 60);
		const seconds = (value % 60).toFixed(3);

		return `${
			minutes.toString(10).padStart(2, '0')}:${
				seconds.split('.')[0].length < 2
					? `0${seconds}`
					: seconds
			}`;
	}

	function update_webvtt(jsonld:JsonLdType) : void
	{
		(webvtt as HTMLTextAreaElement).textContent = `WEBVTT${
			"\n\n"
		}${jsonld.about.itemListElement.filter((line) => {
			return 'time' in line.item;
		}).map((line, index) => {
			const start = parseFloat(
				(line.item.time as CaptionTime).start.split('T')[1]
			);
			const end = parseFloat(
				(line.item.time as CaptionTime).end.split('T')[1]
			);

			return `${
				index
			}${
				"\n"
			}${
				webvtt_time(start)
			} --> ${
				webvtt_time(end)
			}${
				'number' === typeof(line.item.position)
					? ` position:${line.item.position | 0}%`
					: ''
			}${
				'string' === typeof(line.item.align)
					? ` align:${line.item.align}`
					: ''
			}${
				"\n"
			}${
				line.item.line
			}${
				"\n"
			}`
		}).join("\n")}`;
	}

	document.addEventListener('selectionchange', (e) => {
		const maybe = getSelection()?.anchorNode as Text|null;

		if (
			maybe
			&& (
				maybe.parentNode === editor
				|| maybe.parentNode?.parentNode === editor
			)
		) {
			caption_line = maybe;

			if (settings.has(maybe)) {
				const setting = settings.get(maybe) as CaptionLineSetting;

				form_speaker.value = setting.speaker;
				form_start.value = setting.start;
				form_end.value = setting.end;
				form_position.value = setting.position?.toString(10) || '';
				form_alignment.value = setting.alignment || '';
			} else {
				form.reset();
			}
		}
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();

		const maybe = caption_line;

		if (
			! (
				maybe
				&& (
					maybe.parentNode === editor
					|| maybe.parentNode?.parentNode === editor
				)
			)
		) {
			console.log('skipping processing');

			return;
		}

		const data = new FormData(form);
		const position = (data.get('position') || null) as string|null;
		const align = (
			data.get('alignment') || null
		) as 'start'|'center'|'end'|null;
		const setting = settings.get(maybe) || new CaptionLineSetting(
			'',
			'0',
			'0'
		);

		setting.speaker = data.get('speaker') + '';
		setting.start = data.get('start') + '';
		setting.end = data.get('end') + '';
		setting.position = null !== position ? parseFloat(position) : null;
		setting.alignment = align;

		settings.set(maybe, setting);

		update_webvtt(update_jsonld());
	});

	editor.addEventListener('input', () => {
		update_webvtt(update_jsonld());
	});

	captions.forEach((e) => {
		const [line, setting] = e;

		const line_node = document.createTextNode(line);

		if (setting) {
			settings.set(line_node, setting);
		}

		editor.appendChild(line_node);
		editor.appendChild(document.createTextNode("\n"));
	});

	update_webvtt(update_jsonld());

	main.textContent = '';
	main.appendChild(node);
}

load_await_url();
