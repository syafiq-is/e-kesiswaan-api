const ownerOrRoles = (allowedRoles = [], paramKey = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const resourceUserId = parseInt(req.params[paramKey]);

    const isOwner = req.user.id === resourceUserId;
    const hasRole = allowedRoles.includes(req.user.role);

    if (!isOwner && !hasRole) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

export default ownerOrRoles;
