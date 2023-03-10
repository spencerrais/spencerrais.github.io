import type { SocialObjects } from "./types";

export const SITE = {
  website: "https://spencerrais.github.io",
  author: "Spencer Raisanen",
  desc: "A personal blog where I write about Data Engineering, Software Development, and Markets",
  title: "MDS",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerPage: 3,
};

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/spencerrais",
    linkTitle: ` ${SITE.author} on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/spencerraisanen/",
    linkTitle: `${SITE.author} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:spencerraisanen@live.com",
    linkTitle: `Send an email to ${SITE.author}`,
    active: true,
  } 
];
