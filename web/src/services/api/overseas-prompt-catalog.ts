import type { OverseasPromptEntry } from "@/types/prompt-catalog";

// Curated seed only. Original creators retain rights; do not mirror external media.
// Case practice prompts are adaptations, not the creator's full text.
export const overseasPromptCatalog: OverseasPromptEntry[] = [
  {
    "id": "seedance:storyboard-grid-to-video",
    "contentKind": "template",
    "title": "Storyboard grid to video",
    "titleZh": "分镜网格转视频",
    "summary": "Plan the shots as a storyboard sheet, then animate the sheet. Start here and explore three independently searchable examples.",
    "summaryZh": "先生成分镜网格图，再按分镜生成视频；下方关联三个可独立检索的案例。",
    "category": "Structural foundations",
    "tags": [
      "Storyboard",
      "Video",
      "Multi-step workflow",
      "Character consistency"
    ],
    "sourceModel": "Image model + Seedance (check platform availability)",
    "notes": [
      "This is a planning template for a text model, not a ready-to-submit video prompt. Replace the bracketed story, style and duration before use.",
      "Reference roles are not first/last-frame roles. Choose a model that supports the required references and duration; no generation or billing is triggered here."
    ],
    "sources": [
      {
        "role": "original",
        "label": "Awesome Seedance · template",
        "author": "LearnPrompt / awesome-seedance",
        "url": "https://github.com/LearnPrompt/awesome-seedance/blob/main/docs/templates/zh/storyboard-grid-to-video.md",
        "license": "CC BY 4.0 · curated template; bilingual text assembled from copyPrompt, structure and pitfalls."
      }
    ],
    "relatedIds": [
      "seedance:real-case-06-aimikoda",
      "seedance:real-case-07-techiebysa",
      "seedance:apartment-arrival-storyboard-animation"
    ],
    "steps": [
      {
        "id": "plan",
        "title": "Plan the image and video prompts",
        "instruction": "Copy into your text assistant, fill in your story and desired runtime, then review both generated prompts before using them.",
        "textKind": "licensed-template",
        "originalKind": "full",
        "originalLanguage": "en",
        "prompts": {
          "en": "I want to make the storyboard sheet first and then turn it into video. [The story: a stray cat finding its way home through a rainy night, in 9 panels.] [Pixar-style 3D look, 15 seconds total.] Using the prompt template below, write both prompts for me: first the one that generates the storyboard sheet, then the Seedance prompt that turns that sheet into video:\n\n- Image prompt header: single-page sheet, aspect ratio, panel count, and the drawing style stated as premium storyboard, infographic poster or rough pencil previs\n- Information cards: title, total runtime, number of shots, audio direction, so timing and panel count agree\n- Panel list, one line each: shot size, the action happening in it, and what that panel is for\n- Image prompt tail: the annotation system, and the exclusions such as no timestamps, no extra characters, no watermark\n- Video prompt opening: name which image is the character reference and which is the storyboard, and what each one controls\n- Rule list: follow 1 to N in order, one shot per panel, seconds per shot, no skipped or added steps, character and set stay identical\n- Overall look and close: lighting, camera movement, audio, and the no-subtitle no-watermark tail\n\nAvoid:\n- Baking timecodes into the sheet. Panel timestamps get drawn as artwork and carried into the video; the kung-fu sheet writes `No timestamps` and leaves timing to the rules in step two.\n- More panels than the runtime can hold. Work backwards at 1.5 to 3 seconds per panel — the croissant sheet pairs 8 panels with a 12-second video.\n- Letting the character sheet and the storyboard fight. The model copies poses off the character sheet; state that the storyboard controls locations, actions, compositions and sequence, and the character sheet only controls the face.\n- Panels that describe a picture and no movement. The video comes out as a slideshow; give every panel something already in motion.",
          "zh": "我要先出一张分镜图再把它转成视频，【故事是一只流浪猫在雨夜一路找到家，分成 9 格】，【画风像皮克斯 3D，总时长 15 秒】。请根据下面这个提示语模板，分两步把提示语写好：先写生成分镜图的提示语，再写把这张分镜图转成视频的 Seedance 提示语：\n\n- 出图提示语开头：单页分镜、画幅、格数，画风写成高级分镜、信息图海报或者铅笔草稿预览\n- 信息卡：片名、总时长、镜头数、音频方向，让时长和格数对得上\n- 逐格清单，一格一行：景别、这一格里正在发生的动作、这一格是干什么用的\n- 出图提示语收尾：标注系统，以及排除项，比如不要时间码、不要多余角色、不要水印\n- 视频提示语开头：点名哪张是角色参考、哪张是分镜参考，各自管什么\n- 规则清单：按 1 到 N 走、一格一镜、每镜多少秒、不跳步不加戏、人物和场景全程一致\n- 整体质感与收尾：光线、镜头运动、音频，最后写上不要字幕水印\n\n注意事项：\n- 把时间码画进分镜图里。格子上的时间戳会被当成画面内容一起带进视频，功夫那条在出图段直接写 `No timestamps`，时长交给第二步的规则清单。\n- 格数超出时长能装下的量。按每格 1.5 到 3 秒倒推格数，牛角包那条是 8 格配 12 秒。\n- 角色图和分镜图打架。模型会照抄角色图上的姿势，要写明分镜图管地点、动作、构图和顺序，角色图只管长相。\n- 格子里只写画面不写动作。片子动起来就是几张静止图轮播，每一格都要给一个正在发生的动作。",
          "original": "I want to make the storyboard sheet first and then turn it into video. [The story: a stray cat finding its way home through a rainy night, in 9 panels.] [Pixar-style 3D look, 15 seconds total.] Using the prompt template below, write both prompts for me: first the one that generates the storyboard sheet, then the Seedance prompt that turns that sheet into video:\n\n- Image prompt header: single-page sheet, aspect ratio, panel count, and the drawing style stated as premium storyboard, infographic poster or rough pencil previs\n- Information cards: title, total runtime, number of shots, audio direction, so timing and panel count agree\n- Panel list, one line each: shot size, the action happening in it, and what that panel is for\n- Image prompt tail: the annotation system, and the exclusions such as no timestamps, no extra characters, no watermark\n- Video prompt opening: name which image is the character reference and which is the storyboard, and what each one controls\n- Rule list: follow 1 to N in order, one shot per panel, seconds per shot, no skipped or added steps, character and set stay identical\n- Overall look and close: lighting, camera movement, audio, and the no-subtitle no-watermark tail\n\nAvoid:\n- Baking timecodes into the sheet. Panel timestamps get drawn as artwork and carried into the video; the kung-fu sheet writes `No timestamps` and leaves timing to the rules in step two.\n- More panels than the runtime can hold. Work backwards at 1.5 to 3 seconds per panel — the croissant sheet pairs 8 panels with a 12-second video.\n- Letting the character sheet and the storyboard fight. The model copies poses off the character sheet; state that the storyboard controls locations, actions, compositions and sequence, and the character sheet only controls the face.\n- Panels that describe a picture and no movement. The video comes out as a slideshow; give every panel something already in motion."
        }
      }
    ],
    "referenceMedia": [],
    "outputMedia": [],
    "sourceCompleteness": "complete",
    "mediaRights": "licensed"
  },
  {
    "id": "seedance:real-case-06-aimikoda",
    "contentKind": "case",
    "title": "Meilin · Elemental kung fu",
    "titleZh": "梅林元素功夫表演",
    "summary": "An action performance guided by character and storyboard references. Read the original creator’s prompt alongside the external result.",
    "summaryZh": "角色参考与分镜驱动的动作表演案例。",
    "category": "Action and performance",
    "tags": [
      "Storyboard",
      "Kung fu",
      "Character consistency",
      "Video"
    ],
    "sourceModel": "GPT Image 2 + Seedance 2.0 (curator-reported)",
    "notes": [
      "The previous practice prompts were independently written and have been removed. Existing copies in personal assets are not changed. This case does not contain a complete source transcript.",
      "External media remains on its source host; availability and reuse rights are not guaranteed. No media is mirrored or stored in your assets."
    ],
    "relatedIds": [
      "seedance:storyboard-grid-to-video"
    ],
    "sources": [
      {
        "role": "original",
        "label": "Original post on X",
        "author": "@aimikoda",
        "url": "https://x.com/aimikoda/status/2054460932068200517"
      },
      {
        "role": "curation",
        "label": "GoodCase · case record",
        "url": "https://goodcase.ai/cases/real-case-06-aimikoda"
      },
      {
        "role": "curation",
        "label": "Awesome Seedance · case index",
        "url": "https://github.com/LearnPrompt/awesome-seedance/blob/main/data/cases.json"
      }
    ],
    "steps": [
      {
        "id": "source-excerpt",
        "title": "Original prompt excerpt",
        "instruction": "Only a short excerpt is included here. Read the original post for the complete prompt; this excerpt alone is not the prompt that produced the sample.",
        "textKind": "source-excerpt",
        "originalKind": "excerpt",
        "originalLanguage": "en",
        "originalZh": "创作一份以高强度肢体动作为重点的功夫表演分镜。",
        "prompts": {
          "en": "Create a raw kung fu performance storyboard focused on extreme physical action.",
          "zh": "创作一份以高强度肢体动作为重点的功夫表演分镜。",
          "original": "Create a raw kung fu performance storyboard focused on extreme physical action."
        }
      }
    ],
    "referenceMedia": [],
    "outputMedia": [
      {
        "kind": "video",
        "url": "https://goodcase.ai/media/goodcase/aimikoda-2054460932068200517-01.mp4",
        "poster": "https://goodcase.ai/media/goodcase/aimikoda-2054460932068200517-01.jpg",
        "caption": "Original creator's external sample · @aimikoda"
      }
    ],
    "sourceCompleteness": "excerpt",
    "mediaRights": "pending"
  },
  {
    "id": "seedance:real-case-07-techiebysa",
    "contentKind": "case",
    "title": "French croissant-making process",
    "titleZh": "法式牛角包制作过程",
    "summary": "A storyboard-led baking sequence. Full source prompt available through the original post.",
    "summaryZh": "以分镜组织烘焙过程；完整提示词请通过原帖查看。",
    "category": "Food and process",
    "tags": [
      "Storyboard",
      "Food",
      "Process",
      "Video"
    ],
    "sourceModel": "GPT Image 2 + Seedance 2.0 (curator-reported)",
    "notes": [
      "The previous practice prompts were independently written and have been removed. Existing copies in personal assets are not changed. This case does not contain a complete source transcript.",
      "External media remains on its source host; availability and reuse rights are not guaranteed. No media is mirrored or stored in your assets."
    ],
    "relatedIds": [
      "seedance:storyboard-grid-to-video"
    ],
    "sources": [
      {
        "role": "original",
        "label": "Original post on X",
        "author": "@TechieBySA",
        "url": "https://x.com/TechieBySA/status/2053523775702925768"
      },
      {
        "role": "curation",
        "label": "GoodCase · case record",
        "url": "https://goodcase.ai/cases/real-case-07-techiebysa"
      },
      {
        "role": "curation",
        "label": "Awesome Seedance · case index",
        "url": "https://github.com/LearnPrompt/awesome-seedance/blob/main/data/cases.json"
      }
    ],
    "steps": [
      {
        "id": "source-excerpt",
        "title": "Original prompt excerpt",
        "instruction": "Only a short excerpt is included here. Read the original post for the complete prompt; this excerpt alone is not the prompt that produced the sample.",
        "textKind": "source-excerpt",
        "originalKind": "excerpt",
        "originalLanguage": "en",
        "originalZh": "使用附上的 THE CROISSANT BAKER 分镜图作为精确参考。",
        "prompts": {
          "en": "Use the attached THE CROISSANT BAKER storyboard image as the exact reference.",
          "zh": "使用附上的 THE CROISSANT BAKER 分镜图作为精确参考。",
          "original": "Use the attached THE CROISSANT BAKER storyboard image as the exact reference."
        }
      }
    ],
    "referenceMedia": [],
    "outputMedia": [
      {
        "kind": "video",
        "url": "https://media.goodcase.ai/media/video/real-case-07-techiebysa.mp4",
        "poster": "https://media.goodcase.ai/media/poster/real-case-07-techiebysa.jpg",
        "caption": "Original creator's external sample · @TechieBySA"
      }
    ],
    "sourceCompleteness": "excerpt",
    "mediaRights": "pending"
  },
  {
    "id": "seedance:apartment-arrival-storyboard-animation",
    "contentKind": "case",
    "title": "Apartment arrival storyboard",
    "titleZh": "公寓归家分镜动画",
    "summary": "A homecoming sequence illustrating prop and location continuity. The curator’s transcript is incomplete.",
    "summaryZh": "展示道具与场景连续性的归家案例；整理站收录原文存在截断。",
    "category": "Narrative and continuity",
    "tags": [
      "Storyboard",
      "Narrative",
      "Prop continuity",
      "Video"
    ],
    "sourceModel": "Seedance 2.0 (curator-reported)",
    "notes": [
      "The previous practice prompts were independently written and have been removed. Existing copies in personal assets are not changed. This case does not contain a complete source transcript.",
      "External media remains on its source host; availability and reuse rights are not guaranteed. No media is mirrored or stored in your assets.",
      "The upstream transcript is truncated. We do not present it as a complete original prompt."
    ],
    "relatedIds": [
      "seedance:storyboard-grid-to-video"
    ],
    "sources": [
      {
        "role": "original",
        "label": "Original post on X",
        "author": "@Just_sharon7",
        "url": "https://x.com/Just_sharon7/status/2083912532692001128"
      },
      {
        "role": "curation",
        "label": "GoodCase · case record",
        "url": "https://goodcase.ai/cases/apartment-arrival-storyboard-animation"
      },
      {
        "role": "curation",
        "label": "Awesome Seedance · case index",
        "url": "https://github.com/LearnPrompt/awesome-seedance/blob/main/data/cases.json"
      }
    ],
    "steps": [
      {
        "id": "source-excerpt",
        "title": "Original prompt excerpt",
        "instruction": "Only a short excerpt is included here. Read the original post for the complete prompt; this excerpt alone is not the prompt that produced the sample.",
        "textKind": "source-excerpt",
        "originalKind": "excerpt",
        "originalLanguage": "en",
        "originalZh": "将公寓保持为一个固定且一致的物理环境。",
        "prompts": {
          "en": "Maintain the apartment as one fixed physical environment.",
          "zh": "将公寓保持为一个固定且一致的物理环境。",
          "original": "Maintain the apartment as one fixed physical environment."
        }
      }
    ],
    "referenceMedia": [],
    "outputMedia": [
      {
        "kind": "video",
        "url": "https://media.goodcase.ai/media/video/apartment-arrival-storyboard-animation.mp4",
        "poster": "https://media.goodcase.ai/media/poster/apartment-arrival-storyboard-animation.jpg",
        "caption": "Original creator's external sample · @Just_sharon7"
      }
    ],
    "sourceCompleteness": "truncated",
    "mediaRights": "pending"
  }
];
