/**
 * treeView 文件类型图标数据。
 *
 * path 主要取自 Iconify 的 vscode-icons 图标集（MIT），按当前文档用到的后缀逐个内联，
 * 避免为一棵文件树引入整套图标依赖。.properties 该集未收录，用同风格的 file-type-config 齿轮表示；
 * .yml 取自 file-icons（ISC）、pom.xml 取自 fluent-mdl2（MIT），原因见各条目注释。
 *
 * 每个图标若画布尺寸与 ICON_SIZE 不同，必须显式写 width/height：@iconify/utils 拿它算 viewBox，
 * 缺失时按默认尺寸出框，path 会被裁掉。
 */

export const ICON_SIZE = 32;

/** 后缀 -> 图标包内名称，供 extensionIcons 生成 `mdp-file:<name>` 全限定引用 */
export const EXTENSION_ICONS: Record<string, string> = {
  ".xml": "xml",
  ".yml": "yml",
  // Web 端工程树里是 pnpm-lock.yaml / pnpm-workspace.yaml，与 .yml 同一类型，复用同一个图标
  ".yaml": "yml",
  ".md": "md",
  ".properties": "properties",
  ".sh": "shell",
};

/**
 * 文件名 -> 图标包内名称，优先级高于后缀。
 *
 * detectIcon() 先查 filenameIcons 再按后缀回退，所以 pom.xml 虽为 .xml，也会命中 maven 而非 xml 图标。
 */
export const FILENAME_ICONS: Record<string, string> = {
  "pom.xml": "maven",
};

/** 图标包内容，格式即 Iconify JSON icon set */
export const FILE_ICONS = {
  "xml": {
    body: `<path fill="#f1662a" d="m20.42 21.157l2.211 2.211L30 16l-7.369-7.369l-2.211 2.212L25.58 16Zm-8.84-10.314L9.369 8.631L2 16l7.369 7.369l2.211-2.211L6.42 16Zm5.831-3.166l1.6.437l-4.42 16.209l-1.6-.437z"/>`,
  },
  // vscode-icons 的 file-type-yaml 是 "YAML" 横排字标，内容只占画布纵向 24%（y 12.2→19.8），
  // 而 treeView 的图标框固定 14×14，笔画高仅约 3.5px 看不清；改用 file-icons 的 YAML 官方 "Y" 标，
  // 其内容铺满画布（y 0→512），且 fill 为 currentColor，可像内置 folder/file 图标一样跟随主题配色。
  "yml": {
    body: `<path fill="currentColor" d="M342.016 0H457L114.983 512H0l171.008-256L0 0h114.983L228.5 169.934z"/>`,
    width: 512,
    height: 512,
  },
  "md": {
    body: `<path fill="none" stroke="#755838" d="M2.5 7.955h27v16.091h-27z"/><path fill="#755838" d="M5.909 20.636v-9.272h2.727l2.728 3.409l2.727-3.409h2.727v9.272h-2.727v-5.318l-2.727 3.409l-2.728-3.409v5.318zm17.046 0l-4.091-4.5h2.727v-4.772h2.727v4.772h2.727z"/>`,
  },
  // 不用 vscode-icons:file-type-maven：那是 19 个 linearGradient 加 <defs>/<use href> 的多色 logo，
  // 缩到 14×14 会糊成一团，还要为它背上整套渐变定义；fluent-mdl2 版是单 path 剪影且 fill 本就是
  // currentColor，与内置 folder/file 图标一致。画布 2048，必须显式声明尺寸。
  "maven": {
    body: `<path fill="currentColor" d="M2021 183q9 0 15 6t7 16v4l-317 1565q-3 18-22 18h-274q-9 0-15-6t-7-16v-4l181-1063l-605 1078q-6 11-19 11H754q-8 0-13-5t-8-13L555 723L319 1775q-2 8-7 12t-14 5H27q-9 0-15-6t-7-16v-4L321 200q2-8 8-12t14-5h461q8 0 14 5t8 14l139 1047l543-1054q6-12 20-12z"/>`,
    width: 2048,
    height: 2048,
  },
  "shell": {
    body: `<path fill="#d9b400" d="M29.4 27.6H2.5V4.5h26.9Zm-25.9-1h24.9V5.5H3.5Z"/><path fill="#d9b400" d="m6.077 19.316l-.555-.832l4.844-3.229l-4.887-4.071l.641-.768l5.915 4.928zM12.7 18.2h7.8v1h-7.8zM2.5 5.5h26.9v1.9H2.5z"/>`,
  },
  "properties": {
    body: `<path fill="#99b8c4" d="m23.265 24.381l.9-.894c4.164.136 4.228-.01 4.411-.438l1.144-2.785l.085-.264l-.093-.231c-.049-.122-.2-.486-2.8-2.965V15.5c3-2.89 2.936-3.038 2.765-3.461l-1.139-2.814c-.171-.422-.236-.587-4.37-.474l-.9-.93a20 20 0 0 0-.141-4.106l-.116-.263l-2.974-1.3c-.438-.2-.592-.272-3.4 2.786l-1.262-.019c-2.891-3.086-3.028-3.03-3.461-2.855L9.149 3.182c-.433.175-.586.237-.418 4.437l-.893.89c-4.162-.136-4.226.012-4.407.438l-1.146 2.786l-.09.267l.094.232c.049.12.194.48 2.8 2.962v1.3c-3 2.89-2.935 3.038-2.763 3.462l1.138 2.817c.174.431.236.584 4.369.476l.9.935a20.2 20.2 0 0 0 .137 4.1l.116.265l2.993 1.308c.435.182.586.247 3.386-2.8l1.262.016c2.895 3.09 3.043 3.03 3.466 2.859l2.759-1.115c.436-.173.588-.234.413-4.436m-11.858-6.524a4.957 4.957 0 1 1 6.488 2.824a5.014 5.014 0 0 1-6.488-2.824"/>`,
  },
};
