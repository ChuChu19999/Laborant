from __future__ import annotations
from collections import defaultdict
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from models.research import ResearchMethod
from repositories import research as research_repo


async def build_saved_methods_tree(db: AsyncSession) -> dict[str, Any]:
    """
    Все методы исследования (в том числе входящие в группы), по лаборатории и подразделению.

    У методов без laboratory_id — блок «Без привязки к лаборатории».
    У методов с лабораторией, но без department_id — строки сразу под лабораторией.
    """
    methods = await research_repo.get_all_active_research_methods_for_tree(db)

    by_lab_id: dict[int | None, list[ResearchMethod]] = defaultdict(list)
    for method in methods:
        by_lab_id[method.laboratory_id].append(method)

    def lab_key(value: int | None) -> tuple:
        return (value is None, value or 0)

    laboratories_out: list[dict[str, Any]] = []

    for lab_id in sorted(by_lab_id.keys(), key=lab_key):
        lab_methods = by_lab_id[lab_id]

        if lab_id is None:
            laboratory_name = "Без привязки к лаборатории"
        else:
            lab_obj = lab_methods[0].laboratory
            laboratory_name = (
                (lab_obj.full_name or lab_obj.name) if lab_obj else str(lab_id)
            )

        by_dept_id: dict[int | None, list[ResearchMethod]] = defaultdict(list)
        for method in lab_methods:
            by_dept_id[method.department_id].append(method)

        dept_blocks: list[dict[str, Any]] = []
        methods_without_department: list[dict[str, Any]] = []

        for dept_id in sorted(by_dept_id.keys(), key=lab_key):
            dept_methods = sorted(
                by_dept_id[dept_id],
                key=lambda item: ((item.name or "").lower(), item.id),
            )
            rows = [
                {
                    "id": method.id,
                    "name": method.name,
                    "nd_code": method.nd_code or "",
                    "group_name": method.groups[0].name if method.groups else None,
                }
                for method in dept_methods
            ]
            if dept_id is None:
                methods_without_department.extend(rows)
            else:
                dep_obj = dept_methods[0].department
                department_name = dep_obj.name if dep_obj else str(dept_id)
                dept_blocks.append(
                    {
                        "department_id": dept_id,
                        "department_name": department_name,
                        "methods": rows,
                    }
                )

        dept_blocks.sort(key=lambda item: (item.get("department_name") or "").lower())

        laboratories_out.append(
            {
                "laboratory_id": lab_id,
                "laboratory_name": laboratory_name,
                "departments": dept_blocks,
                "methods_without_department": methods_without_department,
            }
        )

    laboratories_out.sort(key=lambda item: (item.get("laboratory_name") or "").lower())

    return {"laboratories": laboratories_out}
