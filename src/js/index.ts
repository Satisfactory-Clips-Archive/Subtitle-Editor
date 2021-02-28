declare type ItemAsEvent = {
    '@type': 'Event',
    description: string,
    startDate: string,
    endDate: string,
    performer?: {
        '@type': 'Person',
        name: string,
    }[],
};

declare type LineJsonLdType = {
    '@type': 'Event',
    description: string,
    startDate: string,
    endDate: string,
    performer?: {
        '@type': 'Person',
        name: string,
    }[],
};

declare type JsonLdType = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: string,
    itemListElement: {
        '@type': 'ListItem',
        position: number,
        item: string|LineJsonLdType,
    }[],
};

const templates:{[key:string]:HTMLTemplateElement} = {};
const main = document.body.querySelector('main') as HTMLElement;

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
    #speaker:string;

    #start:string;

    #end:string;

    get speaker() : string
    {
        return this.#speaker;
    }

    set speaker(value:string)
    {
        this.#speaker = value.trim();
    }

    get start () : string {
        return this.#start;
    }

    set start(value:string)
    {
        if ( ! numeric.test(value)) {
            throw new Error(
                `CaptionLineSetting.start must be numeric!`
            );
        }

        this.#start = value;
    }

    get end () : string {
        return this.#end;
    }

    set end(value:string)
    {
        if ( ! numeric.test(value)) {
            throw new Error(
                `CaptionLineSetting.end must be numeric!`
            );
        }

        this.#end = value;
    }

    constructor(speaker:string, start:string, end:string)
    {
        this.#start = start;
        this.#end = end;
        this.#speaker = speaker.split(',').map(
            (e) => {
                return e.trim();
            }
        ).filter((e) => {
            return '' !== e.trim();
        }).join(',');
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
    const await_url = clone_template('submit-url');
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
    form.addEventListener('submit', (e) => {
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

        const xml = data.get('xml') + '';
        const txt = data.get('txt') + '';

        if (xml.length > 0) {
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
        } else if (txt.length > 0) {            args[1] = txt.split("\n").map((line) => {
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
    const script = node.querySelector('script') as HTMLScriptElement|null;
    const webvtt = node.querySelector('#webvtt') as HTMLTextAreaElement|null;
    const form = node.querySelector('form') as HTMLFormElement|null;
    const settings:WeakMap<Node, CaptionLineSetting> = new WeakMap();
    let caption_line:Text|null;

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

    if (
        ! form_speaker
        || ! form_start
        || ! form_end
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
            "@type": "ItemList",
            url: id + '',
            itemListElement: [
            ] as {
                '@type': 'ListItem',
                position: number,
                item: any,
            }[]
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
                let item:string|ItemAsEvent = currentNode.textContent + '';

                if (settings.has(currentNode)) {
                    const setting = settings.get(
                        currentNode
                    ) as CaptionLineSetting;

                    item = {
                        '@type': 'Event',
                        description: currentNode.textContent,
                        startDate: `PT${setting.start}S`,
                        endDate: `PT${setting.end}S`,
                    } as ItemAsEvent;

                    if ('' !== setting.speaker) {
                        item.performer = setting.speaker.split(',').map(
                            (e) => {
                                return e.trim();
                            }
                        ).map((name) => {
                            return {
                                '@type': 'Person',
                                name,
                            };
                        });
                    }
                }

                jsonld.itemListElement.push({
                    '@type': 'ListItem',
                    position: index,
                    item,
                });

                ++index;
            }
        }

        (
            script as HTMLScriptElement
        ).textContent = JSON.stringify(jsonld, null, "\t");

        return jsonld;
    }

    function update_webvtt(jsonld:JsonLdType) : void
    {
        (webvtt as HTMLTextAreaElement).textContent = `WEBVTT${
            "\n\n"
        }${jsonld.itemListElement.filter((line) => {
            return 'string' !== typeof(line.item);
        }).map((line) : LineJsonLdType => {
            return line.item as LineJsonLdType;
        }).map((line, index) => {
            const start = parseFloat(line.startDate.split('T')[1]);
            const end = parseFloat(line.endDate.split('T')[1]);

            return `${
                index
            }${
                "\n"
            }${
                Math.floor(start / 60).toString(10).padStart(2, '0')
            }:${
                (start % 60).toString(10)
            } ---> ${
                Math.floor(end / 60).toString(10).padStart(2, '0')
            }:${
                (end % 60).toString(10)
            }${
                "\n"
            }${
                line.description
            }${
                "\n"
            }`
        }).join("\n")}`;
    }

    document.addEventListener('selectionchange', (e) => {
        const maybe = getSelection()?.anchorNode as Text|null;

        if (maybe && maybe.parentNode === editor) {
            caption_line = maybe;

            if (settings.has(maybe)) {
                const setting = settings.get(maybe) as CaptionLineSetting;

                form_speaker.value = setting.speaker;
                form_start.value = setting.start;
                form_end.value = setting.end;
            } else {
                form.reset();
            }
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const maybe = caption_line;

        if ( ! maybe || maybe.parentNode !== editor) {
            console.log('skipping processing');

            return;
        }

        const data = new FormData(form);
        const setting = settings.get(maybe) || new CaptionLineSetting(
            '',
            '0',
            '0'
        );

        setting.speaker = data.get('speaker') + '';
        setting.start = data.get('start') + '';
        setting.end = data.get('end') + '';

        settings.set(maybe, setting);

        update_webvtt(update_jsonld());
    });

    editor.addEventListener('input', () => {
        update_webvtt(update_jsonld());
    });

    console.log(captions);

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
