import {default as schema} from '../schema.json';
import Ajv from 'ajv';

declare type TextCommon = {
	language?:string,
	about?: string,
}

declare type TimelessText = TextCommon&{
	text:string,
}

declare type TextOrTextArray = [
	(string|TimelessText),
	...(string|TimelessText)[]
];

declare type CaptionItem = TextCommon&{
	text:string|TextOrTextArray,
	speaker?: string[],
	startTime?: string,
	endTime?:string,
	followsOnFromPrevious?:boolean,
	webvtt?: CaptionItemWebVTT,
};

declare type CaptionItemHasWebVTT = CaptionItem & {
	webvtt: CaptionItemWebVTT,
};

declare type CaptionItemHasBothTimes = CaptionItem & {
	startTime: string,
	endTime:string,
};

declare type CaptionItemWebVTT = {
	position?:number,
	line?:number,
	size?:number,
	align?:'start'|'middle'|'end',
}

declare type JsonLdTypeTranslation<T> = {
	language: T&string,
	text: [CaptionItem, ...CaptionItem[]],
};

declare type JsonLdType = JsonLdTypeTranslation<'en'|'en-GB'|'en-US'>&{
	about: string, // video url
	translation?: [
		JsonLdTypeTranslation<string>,
		...JsonLdTypeTranslation<string>[],
	],
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

	private _line:number|null = null;

	private _size:number|null = null;

	alignment:'start'|'middle'|'end'|null = null;

	followsOnFromPrevious = false;

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
		if (isNaN(parseFloat(value))) {
			value = '';
		}

		if ('' !== value && ! numeric.test(value)) {
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
		if (isNaN(parseFloat(value))) {
			value = '';
		}

		if ('' !== value &&  ! numeric.test(value)) {
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
		value = 'string' === typeof(value) ? parseFloat(value) : value;

		if (null === value || isNaN(value)) {
			this._position = null;
		} else {
			this._position = Math.max(0, value) | 0;
		}
	}

	get line() : number|null
	{
		return this._line;
	}

	set line(value:number|null)
	{
		value = 'string' === typeof(value) ? parseFloat(value) : value;

		if (null === value || isNaN(value)) {
			this._line = null;
		} else {
			this._line = Math.max(0, value) | 0;
		}
	}

	get size() : number|null
	{
		return this._size;
	}

	set size(value:number|null)
	{
		value = 'string' === typeof(value) ? parseFloat(value) : value;

		if (null === value || isNaN(value)) {
			this._size = null;
		} else {
			this._size = Math.max(0, value) | 0;
		}
	}

	constructor(
		speaker:string,
		start:string,
		end:string,
		position:number|string|null = null,
		line:number|string|null = null,
		size:number|string|null = null,
		alignment:'start'|'middle'|'end'|null = null,
		followsOnFromPrevious = false
	) {
		this.start = start;
		this.end = end;
		this.speaker = speaker;
		this.followsOnFromPrevious = followsOnFromPrevious;
		this.position = (
			'string' === typeof(position)
				? parseFloat(position)
				: position
		);
		this.line = (
			'string' === typeof(line)
				? parseFloat(line)
				: line
		);
		this.size = (
			'string' === typeof(size)
				? parseFloat(size)
				: size
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

		const args:[
			VideoId,
			[string|TextOrTextArray, CaptionLineSetting?][]?,
		] = [
			id,
		];

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

				args[1] = json_data.text.map(
					(
						line_data
					) : [string|TextOrTextArray, CaptionLineSetting] => {
					const start = (
						(line_data.startTime ?? 'PT0S').replace(
							/^PT(.+)S$/,
							'$1'
						)
					);
					const end = (
						(line_data.endTime ?? 'PT0S').replace(
							/^PT(.+)S$/,
							'$1'
						)
					);
					const webvtt = line_data.webvtt ?? {};

					return [line_data.text, new CaptionLineSetting(
						(line_data.speaker ?? []).join(', '),
						start,
						end,
						webvtt.position ?? null,
						webvtt.line ?? null,
						webvtt.size ?? null,
						webvtt.align ?? null,
						line_data.followsOnFromPrevious ?? false
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
	captions:[string|TextOrTextArray, CaptionLineSetting?][] = []
) : void
{
	const node = clone_template('editor');
	const settings:WeakMap<Node, CaptionLineSetting> = new WeakMap();
	let caption_line:Text|HTMLElement|null;
	let speakers:string[] = [];
	let previous_speakers:string[] = [];
	const last_speaker_positions:{[key:string]: string|null} = {};
	const last_speaker_lines:{[key:string]: string|null} = {};
	const last_speaker_sizes:{[key:string]: string|null} = {};
	const last_speaker_alignment:{[key:string]: 'start'|'middle'|'end'|null} = {};

	const [
		editor,
		embed,
		script,
		webvtt,
		form,
		form_speaker,
		form_followsOnFromPrevious,
		form_start,
		form_end,
		form_position,
		form_line,
		form_size,
		form_alignment,
		speaker_list,
		line_output,
		previous,
		next,
		form_about,
		form_set_about,
		form_speaker_preset,
		form_add_preset,
		webvtt_presets_go_here,
	] = (() : [
		HTMLElement,
		HTMLElement,
		HTMLTextAreaElement,
		HTMLTextAreaElement,
		HTMLFormElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLInputElement,
		HTMLDataListElement,
		HTMLOutputElement,
		HTMLButtonElement,
		HTMLButtonElement,
		HTMLInputElement,
		HTMLButtonElement,
		HTMLInputElement,
		HTMLButtonElement,
		HTMLLIElement,
	] => {
		const editor = (
			node.querySelector('[contenteditable]') as HTMLElement|null
		);
		const embed = (
			node.querySelector('.embed') as HTMLElement|null
		);
		const script = (
			node.querySelector('#json-ld') as HTMLTextAreaElement|null
		);
		const webvtt = (
			node.querySelector('#webvtt') as HTMLTextAreaElement|null
		);
		const form = (
			node.querySelector('form') as HTMLFormElement|null
		);

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
		const form_followsOnFromPrevious = (
			form.querySelector('#follows-on-from-previous') as HTMLInputElement|null
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
		const form_line = (
			form.querySelector('#line') as HTMLInputElement|null
		);
		const form_size = (
			form.querySelector('#size') as HTMLInputElement|null
		);
		const form_alignment = (
			form.querySelector('#alignment') as HTMLInputElement|null
		);
		const speaker_list = (
			form.querySelector('#speaker-list') as HTMLDataListElement|null
		);
		const line_output = (
			form.querySelector('output[for="editor"]') as HTMLOutputElement|null
		);
		const previous = (
			form.querySelector('button#previous-line') as HTMLButtonElement|null
		);
		const next = (
			form.querySelector('button#next-line') as HTMLButtonElement|null
		);
		const form_about = (
			form.querySelector('#about') as HTMLInputElement|null
		);
		const form_set_about = (
			form.querySelector('button#set-about') as HTMLButtonElement|null
		);
		const form_speaker_preset = (
			form.querySelector('#speaker-preset') as HTMLInputElement|null
		);
		const form_add_preset = (
			form.querySelector('#add-preset') as HTMLButtonElement|null
		);
		const webvtt_presets_go_here = (
			form.querySelector('#presets-go-here') as HTMLLIElement|null
		);

		if (
			! form_speaker
			|| ! form_followsOnFromPrevious
			|| ! form_start
			|| ! form_end
			|| ! form_position
			|| ! form_line
			|| ! form_size
			|| ! form_alignment
			|| ! speaker_list
			|| ! line_output
			|| ! previous
			|| ! next
			|| ! form_about
			|| ! form_set_about
			|| ! form_speaker_preset
			|| ! form_add_preset
			|| ! webvtt_presets_go_here
		) {
			throw new Error(
				'Required components of form not found!'
			);
		}
		return [
			editor,
			embed,
			script,
			webvtt,
			form,
			form_speaker,
			form_followsOnFromPrevious,
			form_start,
			form_end,
			form_position,
			form_line,
			form_size,
			form_alignment,
			speaker_list,
			line_output,
			previous,
			next,
			form_about,
			form_set_about,
			form_speaker_preset,
			form_add_preset,
			webvtt_presets_go_here,
		];
	})();

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
			loop: '1',
			rel: '0',
			widget_referer: location.toString(),
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

	function editor_iterator() : (Text|HTMLElement)[]
	{
		return [...editor.childNodes].filter(
			(maybe) : boolean => {
				if (
					"\n" !== maybe.textContent
					&& '' === maybe.textContent?.trim()
				) {
					return false;
				}

				return (
					(maybe instanceof Text)
					|| (maybe instanceof HTMLDivElement)
				);
			}
		) as (Text|HTMLDivElement)[];
	}

	function update_jsonld() : JsonLdType
	{
		const iterator = editor_iterator();

		const jsonld:JsonLdType = {
			about: id + '',
			language: 'en',
			text: [
				{
					text: '',
				}
			],
		};

		const items:CaptionItem[] = [];

		for (let currentNode of iterator) {
			if (
				currentNode === editor
				|| '' === (currentNode.textContent?.trim() + '')
			) {
				continue;
			} else {
				let item:CaptionItemHasWebVTT = {
					text: currentNode.textContent + '',
					webvtt: {},
				};

				if (currentNode.childNodes.length > 1) {
					item.text = [...currentNode.childNodes].map((chunk) => {
						if (
							(chunk instanceof HTMLElement)
							&& 'MARK' === chunk.nodeName
							&& (
								'about' in chunk.dataset
							)
						) {
							const chunk_text:TimelessText = {
								text: chunk.textContent + '',
							};

							if (
								'about' in chunk.dataset
								&& '' !== chunk.dataset.about?.trim()
							) {
								chunk_text.about = chunk.dataset.about?.trim();
							}

							return chunk_text;
						}

						return chunk.textContent + '';
					}) as TextOrTextArray;
				}

				if (settings.has(currentNode)) {
					const setting = settings.get(
						currentNode
					) as CaptionLineSetting;

					item.startTime = `PT${setting.start}S`;
					item.endTime =`PT${setting.end}S`;

					if ('' !== setting.speaker) {
						item.speaker = setting.speaker.split(',').map(
							(e) => {
								return e.trim();
							}
						);
					}

					item.followsOnFromPrevious = setting.followsOnFromPrevious;

					if (null !== setting.position) {
						item.webvtt.position = setting.position;
					}

					if (null !== setting.line) {
						item.webvtt.line = setting.line;
					}

					if (null !== setting.size) {
						item.webvtt.size = setting.size;
					}

					if (null !== setting.alignment) {
						item.webvtt.align = setting.alignment;
					}
				}

				const filtered_item:CaptionItem = item;

				if ( ! filtered_item.followsOnFromPrevious) {
					delete filtered_item.followsOnFromPrevious;
				}

				if (
					'webvtt' in filtered_item
					&& 0 === Object.keys(
						filtered_item.webvtt as CaptionItemWebVTT
					).length
				) {
					delete filtered_item.webvtt;
				}

				items.push(item);
			}
		}

		if (items.length > 0) {
			jsonld.text = (items as [CaptionItem, ...CaptionItem[]]);
		}

		script.textContent = JSON.stringify(jsonld, null, "\t");

		speakers = jsonld.text.reduce(
			(result:string[], item) : string[] => {
				if (
					item.speaker
				) {
					item.speaker.forEach((speaker) => {
						if ( ! result.includes(speaker)) {
							result.push(speaker);
						}
					});
				}

				return result;
			},
			[]
		).sort();

		if (previous_speakers.join("\n") !== speakers.join("\n")) {
			speaker_list.textContent = '';
			speaker_list.appendChild(
				speakers.reduce(
					(
						result:DocumentFragment,
						speaker:string
					) : DocumentFragment => {
						const option = document.createElement('option');
						option.value = speaker;

						result.appendChild(option);

						return result;
					},
					document.createDocumentFragment()
				)
			);
		}

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
		webvtt.textContent = `WEBVTT${
			"\n\n"
		}${jsonld.text.filter((line) => {
			return 'startTime' in line && 'endTime' in line;
		}).map((line, index) => {
			const start = parseFloat(
				(line as CaptionItemHasBothTimes).startTime.split('T')[1]
			);
			const end = parseFloat(
				(line as CaptionItemHasBothTimes).endTime.split('T')[1]
			);

			const webvtt:CaptionItemWebVTT = line.webvtt || {};

			return `${
				index
			}${
				"\n"
			}${
				webvtt_time(start)
			} --> ${
				webvtt_time(end)
			}${
				'number' === typeof(webvtt.position)
					? ` position:${webvtt.position | 0}%`
					: ''
			}${
				'number' === typeof(webvtt.line)
					? ` line:${webvtt.line | 0}%`
					: ''
			}${
				('number' === typeof(webvtt.size) && webvtt.size > 0)
					? ` size:${webvtt.size | 0}%`
					: ''
			}${
				'string' === typeof(webvtt.align)
					? ` align:${webvtt.align}`
					: ''
			}${
				"\n"
			}${
				(
					(
						line.text instanceof Array
							? line.text
							: [line.text]
					) as TextOrTextArray
				).map(
					(chunk) : string => {
						if ('string' === typeof(chunk)) {
							return chunk;
						}

						return chunk.text;
					}
				).join('')
			}${
				"\n"
			}`
		}).join("\n")}`;
	}

	function update_settings_from_caption_line () : void
	{
		const maybe = caption_line;

		if (maybe) {
			line_output.textContent = caption_line?.textContent + '';

			if (settings.has(maybe)) {
				const setting = settings.get(maybe) as CaptionLineSetting;

				form_speaker.value = setting.speaker;
				form_followsOnFromPrevious.checked = setting.followsOnFromPrevious;
				form_start.value = setting.start;
				form_end.value = setting.end;
				form_position.value = setting.position?.toString(10) || '';
				form_line.value = setting.line?.toString(10) || '';
				form_size.value = setting.size?.toString(10) || '';
				form_alignment.value = setting.alignment || '';

				form_input_handler();
			} else {
				form?.reset();
			}
		}
	}

	function render_webvtt_presets() : void
	{
		const fragment = document.createDocumentFragment();

		speakers.forEach((speaker) => {
			const list = document.createElement('dl');
			const list_contents = document.createDocumentFragment();

			[
				['Position', last_speaker_positions[speaker] ?? null],
				['Line', last_speaker_lines[speaker] ?? null],
				['Size', last_speaker_sizes[speaker] ?? null],
				['Alignment', last_speaker_alignment[speaker] ?? null],
			].filter((maybe) => {
				return null !== maybe[1];
			}).forEach((e) => {
				const [title, value] = e;

				const title_element = document.createElement('dt');
				const value_element = document.createElement('dd');

				title_element.textContent = title;
				value_element.textContent = value;

				list_contents.appendChild(title_element);
				list_contents.appendChild(value_element);
			});

			if (list_contents.childNodes.length > 0) {
				const details = document.createElement('details');
				const summary = document.createElement('summary');
				summary.textContent = speaker;
				details.appendChild(summary);
				list.appendChild(list_contents);
				details.appendChild(list);
				fragment.appendChild(details);
			}
		});

		webvtt_presets_go_here.textContent = '';
		webvtt_presets_go_here.appendChild(fragment);
	}

	document.addEventListener('selectionchange', (e) => {
		const selection = getSelection();

		let child_count = editor_iterator().reduce(
			(child_count:number, node) : number => {
				if (selection?.containsNode(node)) {
					++child_count;
				} else {
					child_count = [...node.childNodes].reduce(
						(child_count, child_node) => {
							if (selection?.containsNode(child_node)) {
								++child_count;
							}

							return child_count;
						},
						child_count
					);
				}

				return child_count;
			},
			0
		);

		if (1 === child_count) {
			form_set_about.disabled = ! form_about.validity.valid;
		} else {
			form_set_about.disabled = true;
		}
	});

	form_set_about.addEventListener('click', () => {
		const mark = document.createElement('mark');
		mark.setAttribute('data-about', form_about.value);
		getSelection()?.getRangeAt(0).surroundContents(mark);
		update_webvtt(update_jsonld());
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
	});

	function form_input_handler() {
		const speaker = form_speaker.value.trim();
		let position = form_position.value;
		let line = form_line.value;
		let size = form_size.value;
		let alignment = form_alignment.value as 'start'|'middle'|'end'|'';
		const start = form_start.value;
		const end = form_end.value;
		const followsOnFromPrevious = form_followsOnFromPrevious.checked;

		if ('' !== speaker) {
			if (Number.isNaN(parseInt(position, 10))) {
				position = form_position.value = (
					last_speaker_positions[speaker] ?? ''
				);
			}
			if (Number.isNaN(parseInt(line + '', 10))) {
				line = form_line.value = (
					last_speaker_lines[speaker] ?? ''
				);
			}
			if (Number.isNaN(parseInt(size + '', 10))) {
				size = form_size.value = (
					last_speaker_sizes[speaker] ?? ''
				);
			}
			if ('' === (alignment + '')) {
				alignment = form_alignment.value = (
					last_speaker_alignment[speaker] || ''
				);
			}
		}

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

		const setting = settings.get(maybe) || new CaptionLineSetting(
			'',
			'0',
			'0'
		);

		setting.speaker = speaker;
		setting.followsOnFromPrevious = followsOnFromPrevious;
		setting.start = start;
		setting.end = end;
		setting.position = null !== position ? parseFloat(position) : null;
		setting.line = null !== line ? parseFloat(line) : null;
		setting.size = null !== size ? parseFloat(size) : null;
		setting.alignment = '' === alignment ? null : alignment;

		settings.set(maybe, setting);

		update_webvtt(update_jsonld());
	};

	form.addEventListener('input', form_input_handler);

	editor.addEventListener('input', () => {
		update_webvtt(update_jsonld());
	});

	previous.addEventListener('click', () => {
		let nodes:(Text|HTMLElement)[] = editor_iterator();

		if (caption_line && nodes.includes(caption_line)) {
			caption_line = nodes[
				(nodes.indexOf(caption_line) || nodes.length) - 1
			];
		} else {
			caption_line = nodes[nodes.length - 1];
		}

		update_settings_from_caption_line();
	});

	next.addEventListener('click', () => {
		const iterator = editor_iterator();

		let use_next_node = false;
		let use_node:Text|HTMLElement|null = null;

		for (let currentNode of iterator) {
			if (use_next_node) {
				use_node = currentNode;
				break;
			}

			if ( ! use_node) {
				use_node = currentNode;
			}

			if (currentNode === caption_line) {
				use_next_node = true;
			}
		}

		caption_line = use_node;

		update_settings_from_caption_line();
	});

	form_add_preset.addEventListener('click', () => {
		const data = new FormData(form);

		const speaker = form_speaker_preset.value.trim();
		const position = (data.get('position') ?? null) as string|null;
		const line = (data.get('line') ?? null) as string|null;
		const size = (data.get('size') ?? null) as string|null;
		const alignment = data.get('alignment') as 'start'|'middle'|'end'|null;

		if ('' !== speaker) {
			if ( ! speakers.includes(speaker)) {
				speakers.push(speaker);
			}

			last_speaker_positions[speaker] = position;
			last_speaker_lines[speaker] = line;
			last_speaker_sizes[speaker] = size;
			last_speaker_alignment[speaker] = alignment;
		}

		render_webvtt_presets();
	});

	captions.forEach((e) => {
		const [line, setting] = e;

		const wrapper = document.createElement('div');

		let line_node:Text|DocumentFragment;

		if (line instanceof Array) {
			line_node = document.createDocumentFragment();

			line.forEach((chunk) => {
				if ('string' === typeof(chunk)) {
					line_node.appendChild(document.createTextNode(chunk));
				} else {
					const chunk_node = document.createElement('mark');

					chunk_node.appendChild(
						document.createTextNode(chunk.text)
					);

					if ('about' in chunk) {
						chunk_node.dataset.about = chunk.about;
					}

					line_node.appendChild(chunk_node);
				}
			});
		} else {
			line_node = document.createTextNode(line);
		}

		wrapper.appendChild(line_node);

		if (setting) {
			settings.set(wrapper, setting);
		}

		editor.appendChild(wrapper);
	});

	caption_line = editor.firstChild as Text|HTMLElement|null;

	const json = update_jsonld();

	json.text.forEach((item) => {
		if (item.speaker) {
			item.speaker.forEach((speaker) => {
				if ( ! speakers.includes(speaker)) {
					speakers.push(speaker);
				}
			});
		}

		if (item.speaker && item.webvtt) {
			const webvtt = item.webvtt as CaptionItemWebVTT;

			(item.speaker as string[]).forEach((speaker) => {
				if (webvtt.position) {
					last_speaker_positions[speaker] = webvtt.position?.toString(10);
				}
				if (webvtt.line) {
					last_speaker_lines[speaker] = webvtt.line?.toString(10);
				}
				if (webvtt.size) {
					last_speaker_sizes[speaker] = webvtt.size?.toString(10);
				}

				if (webvtt.align) {
					last_speaker_alignment[speaker] = webvtt.align;
				}
			});
		}
	});

	update_webvtt(json);

	update_settings_from_caption_line();

	render_webvtt_presets();

	main.textContent = '';
	main.appendChild(node);
}

load_await_url();
