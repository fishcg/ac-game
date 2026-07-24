import type { ActiveSkillHud, ActiveSkillId } from "./types";
import styles from "./ActiveSkillPanel.module.css";

export function ActiveSkillPanel({ skills, onUse }: { skills: ActiveSkillHud[]; onUse: (id: ActiveSkillId) => void }) {
  return (
    <div className={styles.panel} aria-label="一次性主动技能">
      {skills.map((skill, index) => <button key={skill.id} disabled={skill.charges <= 0} onClick={() => onUse(skill.id)} title={skill.description} aria-label={`${skill.name}，剩余${skill.charges}次`}>
        <kbd>{index + 1}</kbd><i>{skill.icon}</i><span><strong>{skill.name}</strong><small>{skill.charges > 0 ? `剩余 ${skill.charges} 次` : "完成任务获取"}</small></span>
      </button>)}
    </div>
  );
}
