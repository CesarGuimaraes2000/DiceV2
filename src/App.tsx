import Stack from "@mui/material/Stack";
import Container from "@mui/material/Container";

import { InteractiveTray } from "./tray/InteractiveTray";
import { Sidebar } from "./controls/Sidebar";
import { ExternalRollSync } from "./plugin/ExternalRollSync";

export function App() {
  return (
    <Container disableGutters maxWidth="md">
      <ExternalRollSync />
      <Stack direction="row" justifyContent="center">
        <Sidebar />
        <InteractiveTray />
      </Stack>
    </Container>
  );
}
