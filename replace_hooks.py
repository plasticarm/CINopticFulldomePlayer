import re

file_path = 'App.tsx'
with open(file_path, 'r') as f:
    content = f.read()

replacements = [
    (r"const \[domeTilt, setDomeTilt\] = useState\(0\);", r"const [domeTilt, setDomeTilt] = useLocalStorage('cv_domeTilt', 0);"),
    (r"const \[postProcessingEnabled, setPostProcessingEnabled\] = useState\(true\);", r"const [postProcessingEnabled, setPostProcessingEnabled] = useLocalStorage('cv_postProcessingEnabled', true);"),
    (r"const \[projectionMode, setProjectionMode\] = useState<'dome' \| 'flat'>\('dome'\);", r"const [projectionMode, setProjectionMode] = useLocalStorage<'dome' | 'flat'>('cv_projectionMode', 'dome');"),
    (r"const \[smoothFovChange, setSmoothFovChange\] = useState\(true\);", r"const [smoothFovChange, setSmoothFovChange] = useLocalStorage('cv_smoothFovChange', true);"),
    (r"const \[useQuaternionRotation, setUseQuaternionRotation\] = useState\(false\);", r"const [useQuaternionRotation, setUseQuaternionRotation] = useLocalStorage('cv_useQuaternionRotation', true);"),
    (r"const \[ambientIntensity, setAmbientIntensity\] = useState\(0.1\);", r"const [ambientIntensity, setAmbientIntensity] = useLocalStorage('cv_ambientIntensity', 0.1);"),
    (r"const \[ambientFalloff, setAmbientFalloff\] = useState\(15.0\);", r"const [ambientFalloff, setAmbientFalloff] = useLocalStorage('cv_ambientFalloff', 50.0);"),
    (r"const \[restrictViewToEdge, setRestrictViewToEdge\] = useState\(false\);", r"const [restrictViewToEdge, setRestrictViewToEdge] = useLocalStorage('cv_restrictViewToEdge', false);"),
    (r"const \[edgePadding, setEdgePadding\] = useState\(2.0\);", r"const [edgePadding, setEdgePadding] = useLocalStorage('cv_edgePadding', 2.0);"),
    (r"const \[allowCameraRoll, setAllowCameraRoll\] = useState\(false\);", r"const [allowCameraRoll, setAllowCameraRoll] = useLocalStorage('cv_allowCameraRoll', false);"),
    (r"const \[vignette, setVignette\] = useState\(-0.30\);", r"const [vignette, setVignette] = useLocalStorage('cv_vignette', -0.10);"),
    (r"const \[bloom, setBloom\] = useState\(4.95\);", r"const [bloom, setBloom] = useLocalStorage('cv_bloom', 3.0);"),
    (r"const \[edgeBlur, setEdgeBlur\] = useState\(0.20\);", r"const [edgeBlur, setEdgeBlur] = useLocalStorage('cv_edgeBlur', 0.10);"),
]

for old, new_str in replacements:
    content = re.sub(old, new_str, content)

with open(file_path, 'w') as f:
    f.write(content)

print("Replaced!")
