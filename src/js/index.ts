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

        load_editor(id);
    });

    main.textContent = '';
    main.appendChild(await_url);
}

function load_editor(id:VideoId) : void
{
    const node = clone_template('editor');
    const editor = node.querySelector('[contenteditable]') as HTMLElement|null;
    const embed = node.querySelector('.embed') as HTMLElement|null;
    const script = node.querySelector('script') as HTMLScriptElement|null;

    if ( ! editor || ! embed || ! script) {
        throw new Error(
            'Required components of editor not found!'
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

    editor.addEventListener('input', () => {
        const iterator = document.createNodeIterator(
            editor,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
        );

        const jsonld = {
            "@context": "https://schema.org",
            "@type": "ItemList",
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
            if (currentNode === editor) {
                continue;
            } else if (currentNode instanceof Text) {
                jsonld.itemListElement.push({
                    '@type': 'ListItem',
                    position: index,
                    item: currentNode.textContent,
                });

                ++index;
            }
        }

        script.textContent = JSON.stringify(jsonld, null, "\t");
    });

    main.textContent = '';
    main.appendChild(node);
}

load_await_url();
