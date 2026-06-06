/**
 * English message dictionary — the source of truth for the message shape.
 * Every namespace is defined in its own file under ./ and merged here.
 * The German dictionary (../de) is type-checked against `typeof en`.
 *
 * NOTE: keep this list and ../de/index.ts in sync. When adding a namespace,
 * create en/<ns>.ts + de/<ns>.ts and register it in both index files.
 */
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

export const en = {
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
};
