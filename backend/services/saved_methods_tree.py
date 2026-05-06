"""Дерево расчётных методов по лабораториям: лаборатория → подразделение (если указано) → методы."""

from collections import defaultdict
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.research import ResearchMethod


async def build_saved_methods_tree(db: AsyncSession) -> Dict[str, Any]:
    """
    Все методы исследования (в том числе входящие в группы), по лаборатории и подразделению.

    У методов без laboratory_id — блок «Без привязки к лаборатории».
    У методов с лабораторией, но без department_id — строки сразу под лабораторией.
    """
    stmt = (
        select(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
        )
    )
    result = await db.execute(stmt)
    methods = list(result.scalars().all())

    by_lab_id: Dict[Optional[int], List[ResearchMethod]] = defaultdict(list)
    for m in methods:
        by_lab_id[m.laboratory_id].append(m)

    def lab_key(v: Optional[int]) -> tuple:
        return (v is None, v or 0)

    laboratories_out: List[Dict[str, Any]] = []

    for lab_id in sorted(by_lab_id.keys(), key=lab_key):
        lab_methods = by_lab_id[lab_id]

        if lab_id is None:
            laboratory_name = "Без привязки к лаборатории"
        else:
            lab_obj = lab_methods[0].laboratory
            laboratory_name = (
                (lab_obj.full_name or lab_obj.name) if lab_obj else str(lab_id)
            )

        by_dept_id: Dict[Optional[int], List[ResearchMethod]] = defaultdict(list)
        for m in lab_methods:
            by_dept_id[m.department_id].append(m)

        dept_blocks: List[Dict[str, Any]] = []
        methods_without_department: List[Dict[str, Any]] = []

        for dept_id in sorted(by_dept_id.keys(), key=lab_key):
            ms = sorted(
                by_dept_id[dept_id],
                key=lambda x: ((x.name or "").lower(), x.id),
            )
            rows = [
                {
                    "id": m.id,
                    "name": m.name,
                    "nd_code": m.nd_code or "",
                    "group_name": m.groups[0].name if m.groups else None,
                }
                for m in ms
            ]
            if dept_id is None:
                methods_without_department.extend(rows)
            else:
                dep_obj = ms[0].department
                department_name = dep_obj.name if dep_obj else str(dept_id)
                dept_blocks.append(
                    {
                        "department_id": dept_id,
                        "department_name": department_name,
                        "methods": rows,
                    }
                )

        dept_blocks.sort(
            key=lambda d: (d.get("department_name") or "").lower(),
        )

        laboratories_out.append(
            {
                "laboratory_id": lab_id,
                "laboratory_name": laboratory_name,
                "departments": dept_blocks,
                "methods_without_department": methods_without_department,
            }
        )

    laboratories_out.sort(
        key=lambda x: (x.get("laboratory_name") or "").lower(),
    )

    return {"laboratories": laboratories_out}
