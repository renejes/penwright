/**
 * German message dictionary. Typed against `typeof en` (via the per-namespace
 * `*Messages` types) so a missing or mis-shaped key is a compile error.
 */
import { en } from '../en';
import { common } from './common';
import { settings } from './settings';
import { menu } from './menu';
import { mainDialogs } from './mainDialogs';
import { design } from './design';
import { look } from './look';
import { designAi } from './designAi';
import { onboarding } from './onboarding';
import { mcp } from './mcp';
import { backup } from './backup';
import { crash } from './crash';
import { version } from './version';
import { project } from './project';
import { comments } from './comments';
import { exportDialog } from './exportDialog';
import { sidebar } from './sidebar';
import { pickers } from './pickers';
import { app } from './app';
import { startScreen } from './startScreen';
import { license } from './license';
import { about } from './about';
import { editor } from './editor';
import { editorLib } from './editorLib';
import { history } from './history';

export const de: typeof en = {
  common,
  settings,
  menu,
  mainDialogs,
  design,
  look,
  designAi,
  onboarding,
  mcp,
  backup,
  crash,
  version,
  project,
  comments,
  exportDialog,
  sidebar,
  pickers,
  app,
  startScreen,
  license,
  about,
  editor,
  editorLib,
  history,
};
